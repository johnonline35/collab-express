const supabase = require("../db/supabase");
const { loadClient } = require("../api/googleCalendar");
const { analyzeMeetings } = require("../services/meetingAnalysis");
const limiter = require("../utils/limiter");
const { collabWorkspaceLinkToAppend } = require("../data/collabUrls");
const fetchPublicEmailDomains = require("../data/listOfEmailDomains");
const {
  getUserEmailFromDB,
  saveSyncTokenForUser,
  loadSyncTokenForUser,
  saveUserTimeZone,
} = require("../utils/database");

const getGoogleCal = async (userId) => {
  const extractDomainFromEmail = (email) => {
    return email.substring(email.lastIndexOf("@") + 1);
  };
  let publicEmailDomains = await fetchPublicEmailDomains();
  let publicEmailDomainsSet = new Set(publicEmailDomains);

  console.log("Just called getGoogleCal, here is the userId:", userId);
  const calendar = await loadClient(userId);

  // Fetch user email from database --
  const userEmail = await getUserEmailFromDB(userId);
  if (!userEmail) {
    console.error("Error: User email not found");
    return [];
  } else {
    // console.log("userEmail:", userEmail);
  }

  const userEmailDomain = extractDomainFromEmail(userEmail);

  let allEvents = [];
  let nextPageToken = undefined;
  let nextSyncToken = undefined;

  try {
    let syncToken = await loadSyncTokenForUser(userId);

    console.log("Starting to fetch Google Calendar events...");

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
          console.log("nextSyncToken", response.data.nextSyncToken);
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

        console.log("userId:", userId, "nextSyncToken:", nextSyncToken);
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
      // Condition 1: Event should have attendees, and their count should be between 2 and 10
      if (
        !event.attendees ||
        event.attendees.length <= 1 ||
        event.attendees.length >= 11
      ) {
        // console.log(
        //   `Filtered out meeting ID: ${
        //     event.id
        //   } due to attendee count. Attendees: ${
        //     event.attendees
        //       ? event.attendees.map((a) => a.email).join(", ")
        //       : "None"
        //   }`
        // );
        return false;
      }

      // Condition 2: Meeting shouldn't start more than 6 months from now
      const eventDateTime = new Date(event.start.dateTime);
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
      if (eventDateTime.getTime() > sixMonthsFromNow.getTime()) {
        // console.log(
        //   `Filtered out meeting ID: ${
        //     event.id
        //   } due to date beyond 6 months. Attendees: ${event.attendees
        //     .map((a) => a.email)
        //     .join(", ")}`
        // );
        return false;
      }

      // Condition 3: If userEmail domain isn't in publicEmailDomains,
      // the event shouldn't have all attendees from the same domain as the user
      if (!publicEmailDomainsSet.has(userEmailDomain)) {
        let allSameDomain = event.attendees.every(
          (attendee) =>
            extractDomainFromEmail(attendee.email) === userEmailDomain
        );
        if (allSameDomain) {
          // console.log(
          //   `Filtered out meeting ID: ${
          //     event.id
          //   } as all attendees from user's domain. Attendees: ${event.attendees
          //     .map((a) => a.email)
          //     .join(", ")}`
          // );
          return false;
        }
      }

      return true;
    });

    console.log("Starting to upsert data into Supabase...");
    // Insert data into the database for each meeting
    const chunkArray = (array, size) => {
      const chunked_arr = [];
      let index = 0;
      while (index < array.length) {
        chunked_arr.push(array.slice(index, size + index));
        index += size;
      }
      return chunked_arr;
    };

    // Breaking the meetings array into chunks of 1,000
    const meetingChunks = chunkArray(meetings, 1000);

    const upsertChunksPromises = meetingChunks.map(async (meetingChunk) => {
      const upsertMeetingChunkPromises = meetingChunk.map(async (meeting) => {
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
          // Directly upsert the meeting
          const { data: upsertMeetingData, error: upsertMeetingError } =
            await supabase
              .from("meetings")
              .upsert([meetingData], { returning: "minimal" });

          if (upsertMeetingError) {
            console.error("Upsert Meeting Error:", upsertMeetingError);
            return;
          }

          // Upsert attendees
          await Promise.all(
            attendees.map(async (attendee) => {
              const { data: upsertAttendeeData, error: upsertAttendeeError } =
                await supabase.from("meeting_attendees").upsert(
                  [
                    {
                      meeting_id: meeting.id,
                      email: attendee.email,
                      organizer: attendee.organizer || false,
                      response_status: attendee.responseStatus,
                    },
                  ],
                  { returning: "minimal" }
                );

              if (upsertAttendeeError) {
                console.error("Upsert Attendee Error:", upsertAttendeeError);
              }
            })
          );
        } catch (error) {
          console.error("Upsert process error:", error);
        }
      });

      // Ensure all meetings in this chunk are upserted
      return Promise.all(upsertMeetingChunkPromises);
    });

    // Ensure all chunks are processed
    await Promise.all(upsertChunksPromises);

    // const upsertPromises = meetings.map(async (meeting) => {
    //   const attendees = meeting.attendees.filter(
    //     (attendee) => attendee.email.trim() !== userEmail.trim()
    //   );

    //   const meetingData = {
    //     id: meeting.id,
    //     summary: meeting.summary,
    //     description: meeting.description,
    //     creator_email: meeting.creator.email,
    //     organizer_email: meeting.organizer.email,
    //     start_dateTime: meeting.start.dateTime,
    //     end_dateTime: meeting.end.dateTime,
    //     start_time_zone: meeting.start.timeZone,
    //     end_time_zone: meeting.end.timeZone,
    //     collab_user_id: userId,
    //   };

    //   try {
    //     // Directly upsert the meeting without using limiter
    //     const { data: upsertMeetingData, error: upsertMeetingError } =
    //       await supabase
    //         .from("meetings")
    //         .upsert([meetingData], { returning: "minimal" });

    //     if (upsertMeetingError) {
    //       console.error("Upsert Meeting Error:", upsertMeetingError);
    //       return;
    //     }

    //     // console.log("Upsert Meeting Data:", upsertMeetingData);

    //     // Now that the meeting has been upserted, upsert attendees without using limiter
    //     await Promise.all(
    //       attendees.map(async (attendee) => {
    //         const { data: upsertAttendeeData, error: upsertAttendeeError } =
    //           await supabase.from("meeting_attendees").upsert(
    //             [
    //               {
    //                 meeting_id: meeting.id,
    //                 email: attendee.email,
    //                 organizer: attendee.organizer || false,
    //                 response_status: attendee.responseStatus,
    //               },
    //             ],
    //             { returning: "minimal" }
    //           );

    //         if (upsertAttendeeError) {
    //           console.error("Upsert Attendee Error:", upsertAttendeeError);
    //         } else {
    //           // console.log("Upsert Attendee Data:", upsertAttendeeData);
    //         }
    //       })
    //     );
    //   } catch (error) {
    //     console.error("Upsert process error:", error);
    //   }
    // });

    // await Promise.all(upsertPromises);
    console.log("Finished upserting data into Supabase.");

    console.log("Starting analyzeMeetings...");
    const analyzedMeetings = await analyzeMeetings(userId);
    console.log("analyzeMeetings finished.");

    return analyzedMeetings;
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

  const newMeetingIds = [];

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
      } else if (!meetingData || meetingData.length === 0) {
        // If upsert was successful and it was a new insertion, add the meeting ID to newMeetingIds
        newMeetingIds.push(meeting.id);
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

  // For each new meeting, insert a collab space link if the user has enabled it:
  for (const id of newMeetingIds) {
    // Fetch the workspace_id for the given meeting id from the Supabase "meetings" table
    const { data, error } = await supabase
      .from("meetings")
      .select("workspace_id")
      .eq("id", id)
      .single();

    if (error) {
      console.error(`Error fetching workspace_id for meeting ID ${id}:`, error);
      continue; // Skip to next iteration in case of an error
    }

    const workspace_id = data.workspace_id;
    const { data: linkEnabledData, error: linkEnabledError } = await supabase
      .from("workspaces")
      .select("workspace_attendee_enable_calendar_link")
      .eq("workspace_id", workspace_id)
      .single();

    if (linkEnabledError) {
      console.error(
        `Error fetching workspace_attendee_enable_calendar_link for workspace_id ${workspace_id}:`,
        linkEnabledError
      );
      continue; // Skip to next iteration in case of an error.
    }

    if (linkEnabledData.workspace_attendee_enable_calendar_link) {
      await enableCalendarLinkForNewMeeting(id, userId, workspace_id);
    }
  }
  return "Updated and/or deleted meetings and attendees successfully";
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
