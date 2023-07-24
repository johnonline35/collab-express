const supabase = require("../db/supabase");
const { loadClient } = require("../api/googleCalendar");
const { getUserEmailFromDB } = require("../utils/database");
const { analyzeMeetings } = require("../services/meetingAnalysis");
const limiter = require("../utils/limiter");
const { collabWorkspaceLinkToAppend } = require("../data/collabUrls");
const {
  saveSyncTokenForUser,
  loadSyncTokenForUser,
} = require("../utils/database");

const getGoogleCal = async (userId) => {
  console.log(userId);
  const calendar = await loadClient(userId);

  // Fetch user email from database:
  const userEmail = await getUserEmailFromDB(userId);
  if (!userEmail) {
    console.error("Error: User email not found");
    return [];
  } else {
    console.log("userEmail:", userEmail);
  }

  let allEvents = [];
  let nextPageToken = undefined;
  let nextSyncToken = undefined;

  try {
    // console.log("starting try catch block");
    let syncToken = await loadSyncTokenForUser(userId);

    if (!syncToken) {
      // For the initial fetch
      do {
        const response = await calendar.events.list({
          calendarId: "primary",
          singleEvents: true,
          orderBy: "startTime",
          pageToken: nextPageToken,
        });

        console.log("response.data", response.data);

        // Save the user's time zone
        await saveUserTimeZone(userId, response.data.timeZone);

        allEvents = allEvents.concat(response.data.items);

        nextPageToken = response.data.nextPageToken;
        nextSyncToken = response.data.nextSyncToken;
        console.log("userId, nextSyncToken:", userId, nextSyncToken);
      } while (nextPageToken);
    } else {
      // For fetching changes afterwards
      do {
        const response = await calendar.events.list({
          calendarId: "primary",
          syncToken: syncToken,
          singleEvents: true,
          pageToken: nextPageToken,
        });

        console.log("response.data2", response.data);

        allEvents = allEvents.concat(response.data.items);

        nextPageToken = response.data.nextPageToken;
        nextSyncToken = response.data.nextSyncToken;
      } while (nextPageToken);
    }

    const meetings = allEvents.filter(
      (event) =>
        event.attendees &&
        event.attendees.length > 1 &&
        event.attendees.length < 11
    );

    // Insert data into the database for each meeting
    const upsertPromises = meetings.map(async (meeting) => {
      const attendees = meeting.attendees.filter(
        (attendee) => attendee.email.trim() !== userEmail.trim()
      );

      const meetingData = {
        id: meeting.id,
        summary: meeting.summary,
        description: meeting.description,
        creator_email: meeting.creator.email,
        organizer_email: meeting.organizer.email,
        start_dateTime: meeting.start.dateTime,
        end_dateTime: meeting.end.dateTime,
        start_time_zone: meeting.start.timeZone,
        end_time_zone: meeting.end.timeZone,
        collab_user_id: userId,
      };

      try {
        // console.log("Upserting meeting data:", meetingData);
        // Wait for the meeting upsert to complete before upserting attendees
        const { data: upsertMeetingData, error: upsertMeetingError } =
          await limiter.schedule(() =>
            supabase
              .from("meetings")
              .upsert([meetingData], { returning: "minimal" })
          );

        if (upsertMeetingError) {
          console.error("Upsert Meeting Error:", upsertMeetingError);
          return;
        }

        // console.log("Upsert Meeting Data:", upsertMeetingData);

        // Now that the meeting has been upserted, upsert attendees
        await Promise.all(
          attendees.map(async (attendee) => {
            const { data: upsertAttendeeData, error: upsertAttendeeError } =
              await limiter.schedule(() =>
                supabase.from("meeting_attendees").upsert(
                  [
                    {
                      meeting_id: meeting.id,
                      email: attendee.email,
                      organizer: attendee.organizer || false,
                      response_status: attendee.responseStatus,
                    },
                  ],
                  { returning: "minimal" }
                )
              );

            if (upsertAttendeeError) {
              console.error("Upsert Attendee Error:", upsertAttendeeError);
            } else {
              // console.log("Upsert Attendee Data:", upsertAttendeeData);
            }
          })
        );
      } catch (error) {
        console.error("Upsert process error:", error);
      }
    });

    await Promise.all(upsertPromises);

    console.log("Starting analyzeMeetings...");
    const analyzedMeetings = await analyzeMeetings(userId);
    console.log("analyzeMeetings finished.");

    // Update the workspace_id for each meeting in the response
    const updatedMeetings = meetings.map((meeting) => {
      const analyzedMeeting = analyzedMeetings.find((m) => m.id === meeting.id);
      if (analyzedMeeting && analyzedMeeting.workspace_id) {
        meeting.workspace_id = analyzedMeeting.workspace_id;
      }
      return meeting;
    });

    // Return the updated meetings along with the first workspace_id
    const response = {
      workspace_id:
        updatedMeetings.length > 0 ? updatedMeetings[0].workspace_id : null,
      meetings: updatedMeetings,
    };

    try {
      await saveSyncTokenForUser(userId, nextSyncToken);
    } catch (error) {
      console.error("Error saving sync token:", error);
    }

    return response;
  } catch (error) {
    console.error("The API returned an error:", error);
    return [];
  }
};

// const getGoogleCal = async (userId) => {
//   console.log(userId);
//   const calendar = await loadClient(userId);

//   // Fetch user email from database:
//   const userEmail = await getUserEmailFromDB(userId);
//   if (!userEmail) {
//     console.error("Error: User email not found");
//     return [];
//   } else {
//     console.log("userEmail:", userEmail);
//   }

//   const now = new Date();
//   const xMonthsAgo = new Date(now.getTime());
//   xMonthsAgo.setMonth(now.getMonth() - 6);
//   const timeMin = xMonthsAgo.toISOString();

//   const xMonthsFromNow = new Date(now.getTime());
//   xMonthsFromNow.setMonth(now.getMonth() + 4);
//   const timeMax = xMonthsFromNow.toISOString();

//   let allEvents = [];
//   let nextPageToken = undefined;

//   try {
//     console.log("starting try catch block");
//     do {
//       const response = await calendar.events.list({
//         calendarId: "primary",
//         timeMin: timeMin,
//         timeMax: timeMax,
//         singleEvents: true,
//         orderBy: "startTime",
//         pageToken: nextPageToken,
//       });

//       console.log(response.data.items);

//       allEvents = allEvents.concat(response.data.items);

//       nextPageToken = response.data.nextPageToken;
//     } while (nextPageToken);

//     const meetings = allEvents.filter(
//       (event) =>
//         event.attendees &&
//         event.attendees.length > 1 &&
//         event.attendees.length < 11
//     );

//     // Insert data into the database for each meeting
//     const upsertPromises = meetings.map(async (meeting) => {
//       const attendees = meeting.attendees.filter(
//         (attendee) => attendee.email.trim() !== userEmail.trim()
//       );

//       const meetingData = {
//         id: meeting.id,
//         summary: meeting.summary,
//         description: meeting.description,
//         creator_email: meeting.creator.email,
//         organizer_email: meeting.organizer.email,
//         start_dateTime: meeting.start.dateTime,
//         end_dateTime: meeting.end.dateTime,
//         start_time_zone: meeting.start.timeZone,
//         end_time_zone: meeting.end.timeZone,
//         collab_user_id: userId,
//       };

//       try {
//         console.log("Upserting meeting data:", meetingData);
//         // Wait for the meeting upsert to complete before upserting attendees
//         const { data: upsertMeetingData, error: upsertMeetingError } =
//           await limiter.schedule(() =>
//             supabase
//               .from("meetings")
//               .upsert([meetingData], { returning: "minimal" })
//           );

//         if (upsertMeetingError) {
//           console.error("Upsert Meeting Error:", upsertMeetingError);
//           return;
//         }

//         console.log("Upsert Meeting Data:", upsertMeetingData);

//         // Now that the meeting has been upserted, upsert attendees
//         await Promise.all(
//           attendees.map(async (attendee) => {
//             const { data: upsertAttendeeData, error: upsertAttendeeError } =
//               await limiter.schedule(() =>
//                 supabase.from("meeting_attendees").upsert(
//                   [
//                     {
//                       meeting_id: meeting.id,
//                       email: attendee.email,
//                       organizer: attendee.organizer || false,
//                       response_status: attendee.responseStatus,
//                     },
//                   ],
//                   { returning: "minimal" }
//                 )
//               );

//             if (upsertAttendeeError) {
//               console.error("Upsert Attendee Error:", upsertAttendeeError);
//             } else {
//               console.log("Upsert Attendee Data:", upsertAttendeeData);
//             }
//           })
//         );
//       } catch (error) {
//         console.error("Upsert process error:", error);
//       }
//     });

//     await Promise.all(upsertPromises);

//     console.log("Starting analyzeMeetings...");
//     const analyzedMeetings = await analyzeMeetings(userId);
//     console.log("analyzeMeetings finished.");

//     // Update the workspace_id for each meeting in the response
//     const updatedMeetings = meetings.map((meeting) => {
//       const analyzedMeeting = analyzedMeetings.find((m) => m.id === meeting.id);
//       if (analyzedMeeting && analyzedMeeting.workspace_id) {
//         meeting.workspace_id = analyzedMeeting.workspace_id;
//       }
//       return meeting;
//     });

//     // Return the updated meetings along with the first workspace_id
//     const response = {
//       workspace_id:
//         updatedMeetings.length > 0 ? updatedMeetings[0].workspace_id : null,
//       meetings: updatedMeetings,
//     };

//     return response;
//   } catch (error) {
//     console.error("The API returned an error:", error);
//     return [];
//   }
// };

const updateMeetingDescription = async (
  workspace_id,
  collab_user_id,
  workspace_attendee_enable_calendar_link
) => {
  const workspaceLink = collabWorkspaceLinkToAppend + workspace_id;

  try {
    // Load the Google Calendar client
    const calendar = await loadClient(collab_user_id);

    // Fetch meeting data from the 'meetings' table
    const { data: meetingData } = await supabase
      .from("meetings")
      .select("*")
      .eq("workspace_id", workspace_id);

    // Loop through each meeting
    for (let meeting of meetingData) {
      // Fetch the Google Calendar event
      const event = await calendar.events.get({
        calendarId: "primary",
        eventId: meeting.id,
      });

      // Check if link needs to be added or removed
      if (workspace_attendee_enable_calendar_link) {
        // Create a hyperlink and prepend it to the existing description
        const hyperlink = `<a href="${workspaceLink}">Collab Workspace</a>`;
        const newDescription =
          hyperlink + "<br/><br/>" + (event.data.description || "");

        // Update the Google Calendar event
        event.data.description = newDescription;
      } else {
        // Remove the hyperlink from the description
        const hyperlinkRegEx = new RegExp(
          `<a href="${workspaceLink.replace(
            /[.*+\-?^${}()|[\]\\]/g,
            "\\$&"
          )}">Collab Workspace</a>`,
          "g"
        );
        event.data.description = event.data.description.replace(
          hyperlinkRegEx,
          ""
        );

        // Remove any remaining line breaks after a hyperlink
        const lineBreaksRegEx = new RegExp("<br/><br/>", "g");
        event.data.description = event.data.description.replace(
          lineBreaksRegEx,
          ""
        );
      }

      // Update the Google Calendar event
      const response = await calendar.events.update({
        calendarId: "primary",
        eventId: meeting.id,
        resource: event.data,
      });
    }
  } catch (error) {
    console.error("The API returned an error: ", error);
  }
};

module.exports = {
  getGoogleCal,
  updateMeetingDescription,
};

// const supabase = require("../services/database");
// const { loadClient } = require("../api/googleCalendar");
// const { getUserEmailFromDB } = require("../utils/email");
// const { analyzeMeetings } = require("../services/meetingAnalysis");
// const limiter = require("../utils/limiter");

// // FETCH MEETINGS FROM GOOGLE CALENDAR
// const getGoogleCal = async (userId) => {
//   console.log(userId);
//   const calendar = await loadClient(userId);

//   // Fetch user email from database
//   const userEmail = await getUserEmailFromDB(userId);
//   if (!userEmail) {
//     console.error("Error: User email not found");
//     return [];
//   } else {
//     console.log("userEmail:", userEmail);
//   }
//   // Comment

//   const now = new Date();
//   const xMonthsAgo = new Date(now.getTime());
//   xMonthsAgo.setMonth(now.getMonth() - 1);
//   const timeMin = xMonthsAgo.toISOString();

//   const xMonthsFromNow = new Date(now.getTime());
//   xMonthsFromNow.setMonth(now.getMonth() + 2);
//   const timeMax = xMonthsFromNow.toISOString();

//   let allEvents = [];
//   let nextPageToken = undefined;

//   try {
//     console.log("starting try catch block");
//     do {
//       const response = await calendar.events.list({
//         calendarId: "primary",
//         timeMin: timeMin,
//         timeMax: timeMax,
//         singleEvents: true,
//         orderBy: "startTime",
//         pageToken: nextPageToken,
//       });

//       allEvents = allEvents.concat(response.data.items);

//       nextPageToken = response.data.nextPageToken;
//     } while (nextPageToken);

//     const meetings = allEvents.filter(
//       (event) =>
//         event.attendees &&
//         event.attendees.length > 1 &&
//         event.attendees.length < 11
//     );

//     // Insert data into the database for each meeting
//     const upsertPromises = meetings.map(async (meeting) => {
//       const attendees = meeting.attendees.filter(
//         (attendee) => attendee.email.trim() !== userEmail.trim()
//       );

//       const meetingData = {
//         id: meeting.id,
//         summary: meeting.summary,
//         creator_email: meeting.creator.email,
//         organizer_email: meeting.organizer.email,
//         start_dateTime: meeting.start.dateTime,
//         end_dateTime: meeting.end.dateTime,
//         collab_user_id: userId,
//       };

//       try {
//         console.log("Upserting meeting data:", meetingData);
//         // Wait for the meeting upsert to complete before upserting attendees
//         const { data: upsertMeetingData, error: upsertMeetingError } =
//           await limiter.schedule(() =>
//             supabase
//               .from("meetings")
//               .upsert([meetingData], { returning: "minimal" })
//           );

//         if (upsertMeetingError) {
//           console.error("Upsert Meeting Error:", upsertMeetingError);
//           return;
//         }

//         console.log("Upsert Meeting Data:", upsertMeetingData);

//         // Now that the meeting has been upserted, upsert attendees
//         await Promise.all(
//           attendees.map(async (attendee) => {
//             const { data: upsertAttendeeData, error: upsertAttendeeError } =
//               await limiter.schedule(() =>
//                 supabase.from("meeting_attendees").upsert(
//                   [
//                     {
//                       meeting_id: meeting.id,
//                       email: attendee.email,
//                       organizer: attendee.organizer || false,
//                       response_status: attendee.responseStatus,
//                     },
//                   ],
//                   { returning: "minimal" }
//                 )
//               );

//             if (upsertAttendeeError) {
//               console.error("Upsert Attendee Error:", upsertAttendeeError);
//             } else {
//               console.log("Upsert Attendee Data:", upsertAttendeeData);
//             }
//           })
//         );
//       } catch (error) {
//         console.error("Upsert process error:", error);
//       }
//     });

//     await Promise.all(upsertPromises);

//     // Log filtered meetings
//     // console.log(JSON.stringify(meetings, null, 2));
//     await analyzeMeetings(userId);
//     return meetings;
//   } catch (error) {
//     console.error("The API returned an error:", error);
//     return [];
//   }
// };

// module.exports = {
//   getGoogleCal,
// };
