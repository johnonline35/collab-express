const supabase = require("../db/supabase");
const { loadClient } = require("../api/googleCalendar");
const { analyzeMeetings } = require("../services/meetingAnalysis");
const limiter = require("../utils/limiter");
const { collabWorkspaceLinkToAppend } = require("../data/collabUrls");
const {
  getUserEmailFromDB,
  saveSyncTokenForUser,
  loadSyncTokenForUser,
  saveUserTimeZone,
} = require("../utils/database");

const getGoogleCal = async (userId) => {
  console.log("Just called getGoogleCal, here is the userId:", userId);
  const calendar = await loadClient(userId);

  // Fetch user email from database:
  const userEmail = await getUserEmailFromDB(userId);
  if (!userEmail) {
    console.error("Error: User email not found");
    return [];
  } else {
    // console.log("userEmail:", userEmail);
  }

  let allEvents = [];
  let nextPageToken = undefined;
  let nextSyncToken = undefined;

  try {
    let syncToken = await loadSyncTokenForUser(userId);

    if (!syncToken) {
      // For the initial fetch
      do {
        const response = await calendar.events.list({
          calendarId: "primary",
          singleEvents: false,
          pageToken: nextPageToken,
        });

        // console.log("response.data", response.data);

        if (response.data.nextSyncToken) {
          // console.log("nextSyncToken", response.data.nextSyncToken);
          nextSyncToken = response.data.nextSyncToken;
        } else {
          console.log("nextSyncToken is not present");
        }

        // Save the user's time zone
        await saveUserTimeZone(userId, response.data.timeZone);

        allEvents = allEvents.concat(response.data.items);

        nextPageToken = response.data.nextPageToken;
        nextSyncToken = response.data.nextSyncToken;

        // Save sync token right after receiving it
        if (nextSyncToken) {
          try {
            await saveSyncTokenForUser(userId, nextSyncToken);
          } catch (error) {
            console.error("Error saving sync token:", error);
          }
        }

        // console.log("userId:", userId, "nextSyncToken:", nextSyncToken);
      } while (nextPageToken);
    } else {
      // For fetching changes afterwards
      do {
        const response = await calendar.events.list({
          calendarId: "primary",
          syncToken: syncToken,
          singleEvents: false,
          pageToken: nextPageToken,
        });

        // console.log("response.data2", response.data);

        allEvents = allEvents.concat(response.data.items);

        nextPageToken = response.data.nextPageToken;
        nextSyncToken = response.data.nextSyncToken;

        if (nextSyncToken) {
          try {
            await saveSyncTokenForUser(userId, nextSyncToken);
          } catch (error) {
            console.error("Error saving sync token:", error);
          }
        }
      } while (nextPageToken);
    }

    // Filter out meetings with no attendees, more than 11 attendees and more than 6 months in the future
    const meetings = allEvents.filter((event) => {
      if (
        !event.attendees ||
        event.attendees.length <= 1 ||
        event.attendees.length >= 11
      ) {
        return false;
      }

      // Check if the meeting starts more than 6 months from now
      const eventDateTime = new Date(event.start.dateTime);
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
      if (eventDateTime.getTime() > sixMonthsFromNow.getTime()) {
        return false;
      }

      // Check if the meeting started more than 5 years ago
      // const fiveYearsAgo = new Date();
      // fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 1);
      // if (eventDateTime.getTime() < fiveYearsAgo.getTime()) {
      //   return false;
      // }

      return true;
    });

    // const meetings = allEvents.filter(
    //   (event) =>
    //     event.attendees &&
    //     event.attendees.length > 1 &&
    //     event.attendees.length < 11
    // );

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
        // console.log("Upserting meeting data:", meetingData.start_dateTime);
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

    // Verify a few records...
    if (meetings.length > 0) {
      const lastMeeting = meetings[meetings.length - 1];
      // console.log("lastMeeting and id:", lastMeeting, lastMeeting.id);
      const { data: savedMeeting, error: fetchMeetingError } = await supabase
        .from("meetings")
        .select("*")
        .eq("id", lastMeeting.id);

      if (fetchMeetingError) {
        console.error("Error fetching meeting:", fetchMeetingError);
      } else if (!savedMeeting || savedMeeting.length === 0) {
        console.error(
          `Meeting with ID ${lastMeeting.id} not found in database`
        );
      } else {
        // console.log(`Verified meeting with ID ${lastMeeting.id} in database`);
      }
    } else {
      // console.log("No meetings found to verify.");
    }

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

    return response;
  } catch (error) {
    console.error("The API returned an error:", error);
    return [];
  }
};

// Update Supabase when a Collab user changes or deletes a Google Calendar event:
const updateGoogleCal = async (userId) => {
  console.log("Just called updateGoogleCal, here is the userId:", userId);
  const calendar = await loadClient(userId);

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

  let syncToken = await loadSyncTokenForUser(userId);

  if (!syncToken) {
    console.error("Error: sync token not found");
    return [];
  }

  // For fetching changes afterwards
  do {
    const response = await calendar.events.list({
      calendarId: "primary",
      syncToken: syncToken,
      singleEvents: false,
      pageToken: nextPageToken,
    });

    console.log("response.data2", response.data);

    allEvents = allEvents.concat(response.data.items);

    nextPageToken = response.data.nextPageToken;
    nextSyncToken = response.data.nextSyncToken;

    if (nextSyncToken) {
      try {
        await saveSyncTokenForUser(userId, nextSyncToken);
      } catch (error) {
        console.error("Error saving sync token:", error);
      }
    }
  } while (nextPageToken);

  const deletedMeetings = allEvents.filter(
    (event) => event.status === "cancelled"
  );
  const activeMeetings = allEvents.filter(
    (event) => event.status !== "cancelled"
  );

  const deletePromises = deletedMeetings.map(async (meeting) => {
    // Delete from meetings table
    const { error: deleteMeetingError } = await supabase
      .from("meetings")
      .delete()
      .match({ id: meeting.id });

    if (deleteMeetingError) {
      console.error("Error deleting Meeting:", deleteMeetingError);
    }

    // Delete all attendees of this meeting from meeting_attendees table
    const { error: deleteAttendeeError } = await supabase
      .from("meeting_attendees")
      .delete()
      .match({ meeting_id: meeting.id });

    if (deleteAttendeeError) {
      console.error("Error deleting Meeting Attendees:", deleteAttendeeError);
    }
  });

  await Promise.all(deletePromises);

  const updatePromises = activeMeetings
    .filter(
      (event) =>
        event.attendees &&
        event.attendees.length > 1 &&
        event.attendees.length < 11
    )
    .map(async (meeting) => {
      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .upsert(
          {
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
          },
          {
            conflictFields: ["id"], // This specifies that if there's a conflict on the 'id' column, an update should be performed.
          }
        );

      if (meetingError) {
        console.error("Error updating Meeting:", meetingError);
      }

      const attendees = meeting.attendees.filter(
        (attendee) => attendee.email.trim() !== userEmail.trim()
      );

      const currentAttendeesResponse = await supabase
        .from("meeting_attendees")
        .select("email")
        .eq("meeting_id", meeting.id);

      const currentAttendees = currentAttendeesResponse.data.map(
        (a) => a.email
      );

      const attendeesToRemove = currentAttendees.filter(
        (dbAttendee) =>
          !attendees.some((newAttendee) => newAttendee.email === dbAttendee)
      );

      // Delete attendees that no longer exist in the updated list
      await Promise.all(
        attendeesToRemove.map(async (removedAttendeeEmail) => {
          await supabase
            .from("meeting_attendees")
            .delete()
            .eq("meeting_id", meeting.id)
            .eq("email", removedAttendeeEmail);
        })
      );

      // Upsert remaining attendees
      await Promise.all(
        attendees.map(async (attendee) => {
          const { error: attendeeError } = await supabase
            .from("meeting_attendees")
            .upsert(
              {
                meeting_id: meeting.id,
                email: attendee.email,
                organizer: attendee.organizer || false,
                response_status: attendee.responseStatus,
              },
              { conflictFields: ["meeting_id", "email"] }
            );
          if (attendeeError) {
            console.error("Error updating Attendee:", attendeeError);
          }
        })
      );
    });

  await Promise.all(updatePromises);

  // Call getGoogleCal at the end to make sure all meetings and attendees have a workspace_id:
  await getGoogleCal(userId);

  return "Updated and deleted meetings and attendees successfully";
};

// const updateGoogleCal = async (userId) => {
//   console.log("Just called updateGoogleCal, here is the userId:", userId);
//   const calendar = await loadClient(userId);

//   const userEmail = await getUserEmailFromDB(userId);
//   if (!userEmail) {
//     console.error("Error: User email not found");
//     return [];
//   } else {
//     console.log("userEmail:", userEmail);
//   }

//   let allEvents = [];
//   let nextPageToken = undefined;
//   let nextSyncToken = undefined;

//   let syncToken = await loadSyncTokenForUser(userId);

//   if (!syncToken) {
//     console.error("Error: sync token not found");
//     return [];
//   }

//   // For fetching changes afterwards
//   do {
//     const response = await calendar.events.list({
//       calendarId: "primary",
//       syncToken: syncToken,
//       singleEvents: false,
//       pageToken: nextPageToken,
//     });

//     console.log("response.data2", response.data);

//     allEvents = allEvents.concat(response.data.items);

//     nextPageToken = response.data.nextPageToken;
//     nextSyncToken = response.data.nextSyncToken;

//     if (nextSyncToken) {
//       try {
//         await saveSyncTokenForUser(userId, nextSyncToken);
//       } catch (error) {
//         console.error("Error saving sync token:", error);
//       }
//     }
//   } while (nextPageToken);

//   const meetings = allEvents.filter(
//     (event) =>
//       event.attendees &&
//       event.attendees.length > 1 &&
//       event.attendees.length < 11
//   );

//   // Insert data into the database for each meeting
//   const updatePromises = meetings.map(async (meeting) => {
//     // Update only if existing
//     // const { data: meetingData, error: meetingError } = await supabase
//     //   .from("meetings")
//     //   .update({
//     //     summary: meeting.summary,
//     //     description: meeting.description,
//     //     creator_email: meeting.creator.email,
//     //     organizer_email: meeting.organizer.email,
//     //     start_dateTime: meeting.start.dateTime,
//     //     end_dateTime: meeting.end.dateTime,
//     //     start_time_zone: meeting.start.timeZone,
//     //     end_time_zone: meeting.end.timeZone,
//     //     collab_user_id: userId,
//     //   })
//     //   .match({ id: meeting.id });

//     const { data: meetingData, error: meetingError } = await supabase
//       .from("meetings")
//       .upsert(
//         {
//           id: meeting.id,
//           summary: meeting.summary,
//           description: meeting.description,
//           creator_email: meeting.creator.email,
//           organizer_email: meeting.organizer.email,
//           start_dateTime: meeting.start.dateTime,
//           end_dateTime: meeting.end.dateTime,
//           start_time_zone: meeting.start.timeZone,
//           end_time_zone: meeting.end.timeZone,
//           collab_user_id: userId,
//         },
//         {
//           conflictFields: ["id"], // This specifies that if there's a conflict on the 'id' column, an update should be performed.
//         }
//       );

//     if (meetingError) {
//       console.error("Error updating Meeting:", meetingError);
//     }

//     const attendees = meeting.attendees.filter(
//       (attendee) => attendee.email.trim() !== userEmail.trim()
//     );

//     await Promise.all(
//       attendees.map(async (attendee) => {
//         // Upsert
//         const { error: attendeeError } = await supabase
//           .from("meeting_attendees")
//           .upsert(
//             {
//               meeting_id: meeting.id,
//               email: attendee.email,
//               organizer: attendee.organizer || false,
//               response_status: attendee.responseStatus,
//             },
//             { conflictFields: ["meeting_id", "email"] }
//           );
//         if (attendeeError) {
//           console.error("Error updating Attendee:", attendeeError);
//         }
//       })
//     );
//   });

//   await Promise.all(updatePromises);

//   return "Updated meetings and attendees successfully";
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
        const hyperlink = `<a href="${workspaceLink}">Collab Space</a>`;
        let newDescription = event.data.description || "";

        // Check if the hyperlink does not already exist in the description
        if (!newDescription.includes(workspaceLink)) {
          newDescription = newDescription
            ? hyperlink + "<br/><br/>" + newDescription
            : hyperlink;

          // Update the Google Calendar event
          event.data.description = newDescription;
        }
      } else {
        // Remove the hyperlink from the description
        const hyperlinkRegEx = new RegExp(
          `<a href="${workspaceLink.replace(
            /[.*+\-?^${}()|[\]\\]/g,
            "\\$&"
          )}">Collab Space</a>`,
          "g"
        );
        if (event.data && event.data.description) {
          event.data.description = event.data.description.replace(
            hyperlinkRegEx,
            ""
          );
        }

        // Remove any remaining line breaks after a hyperlink
        const lineBreaksRegEx = new RegExp("<br/><br/>", "g");
        if (event.data && event.data.description) {
          event.data.description = event.data.description.replace(
            lineBreaksRegEx,
            ""
          );
        }
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

const enableCalendarLinkForNewMeeting = async (
  id,
  collab_user_id,
  workspace_id
) => {
  console.log(
    "enableCalendarLinkForNewMeeting Called Successfully",
    "id:",
    id,
    "collab_user_id:",
    collab_user_id,
    "workspace_id:",
    workspace_id
  );

  const workspaceLink = collabWorkspaceLinkToAppend + workspace_id;
  console.log("workspaceLink:", workspaceLink);

  try {
    // Load the Google Calendar client
    const calendar = await loadClient(collab_user_id);
    const event = await calendar.events.get({
      calendarId: "primary",
      eventId: id,
    });

    // Create a hyperlink and prepend it to the existing description
    const hyperlink = `<a href="${workspaceLink}">Collab Space</a>`;
    let newDescription = event.data.description || "";

    let response; // Declare response here

    // Check if the hyperlink does not already exist in the description
    if (!newDescription.includes(workspaceLink)) {
      newDescription = newDescription
        ? hyperlink + "<br/><br/>" + newDescription
        : hyperlink;

      // Update the Google Calendar event
      event.data.description = newDescription;

      console.log("newDescription", newDescription);

      response = await calendar.events.update({
        calendarId: "primary",
        eventId: id,
        resource: event.data,
      });

      console.log(
        "This is the entire response object from GOOGLE CALENDAR:",
        response
      );
    }
    return response;
  } catch (error) {
    console.error("The API returned an error: ", error);
    throw new Error("Failed to update the calendar event.");
  }
};

module.exports = {
  getGoogleCal,
  updateGoogleCal,
  updateMeetingDescription,
  enableCalendarLinkForNewMeeting,
};
