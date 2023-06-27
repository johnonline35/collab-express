const supabase = require("../services/database");
const { loadClient } = require("../api/googleCalendar");
const { getUserEmailFromDB } = require("../utils/email");
const { analyzeMeetings } = require("../services/meetingAnalysis");
const limiter = require("../utils/limiter");

const getGoogleCal = async (userId) => {
  console.log(userId);
  const calendar = await loadClient(userId);

  // Fetch user email from database
  const userEmail = await getUserEmailFromDB(userId);
  if (!userEmail) {
    console.error("Error: User email not found");
    return [];
  } else {
    console.log("userEmail:", userEmail);
  }

  const now = new Date();
  const twentyFourMonthsAgo = new Date(now.getTime());
  twentyFourMonthsAgo.setMonth(now.getMonth() - 1);
  const timeMin = twentyFourMonthsAgo.toISOString();

  const twoMonthsFromNow = new Date(now.getTime());
  twoMonthsFromNow.setMonth(now.getMonth() + 2);
  const timeMax = twoMonthsFromNow.toISOString();

  let allEvents = [];
  let nextPageToken = undefined;

  try {
    console.log("starting try catch block");
    do {
      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin: timeMin,
        timeMax: timeMax,
        singleEvents: true,
        orderBy: "startTime",
        pageToken: nextPageToken,
      });

      allEvents = allEvents.concat(response.data.items);

      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

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
        creator_email: meeting.creator.email,
        organizer_email: meeting.organizer.email,
        start_dateTime: meeting.start.dateTime,
        end_dateTime: meeting.end.dateTime,
        collab_user_id: userId,
      };

      try {
        console.log("Upserting meeting data:", meetingData);
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

        console.log("Upsert Meeting Data:", upsertMeetingData);

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
              console.log("Upsert Attendee Data:", upsertAttendeeData);
            }
          })
        );
      } catch (error) {
        console.error("Upsert process error:", error);
      }
    });

    await Promise.all(upsertPromises);

    // Log filtered meetings
    // console.log(JSON.stringify(meetings, null, 2));
    console.log("Starting analyzeMeetings...");
    await analyzeMeetings(userId);
    console.log("analyzeMeetings finished.");

    // Fetch the workspace_id after analyzeMeetings
    const workspaceId = await fetchWorkspaceId(userId);
    console.log("Fetched workspace_id:", workspaceId);

    return meetings;
  } catch (error) {
    console.error("The API returned an error:", error);
    return [];
  }
};

const fetchWorkspaceId = async (userId) => {
  // Fetch the workspace_id using userId
  // You can modify this code to retrieve the workspace_id based on your database schema and logic
  try {
    const { data, error } = await supabase
      .from("workspaces")
      .select("workspace_id")
      .eq("collab_user_id", userId)
      .limit(1);

    if (error) {
      console.error("Error fetching workspace_id:", error);
      return null;
    }

    if (data.length > 0) {
      return data[0].workspace_id;
    } else {
      console.error("Workspace not found for user:", userId);
      return null;
    }
  } catch (error) {
    console.error("Error fetching workspace_id:", error);
    return null;
  }
};

module.exports = {
  getGoogleCal,
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
//   const twentyFourMonthsAgo = new Date(now.getTime());
//   twentyFourMonthsAgo.setMonth(now.getMonth() - 1);
//   const timeMin = twentyFourMonthsAgo.toISOString();

//   const twoMonthsFromNow = new Date(now.getTime());
//   twoMonthsFromNow.setMonth(now.getMonth() + 2);
//   const timeMax = twoMonthsFromNow.toISOString();

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
