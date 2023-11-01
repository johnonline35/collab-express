const express = require("express");
const router = express.Router();
const googleCalendarApiClient = require("../api/googleCalendarApiClient");
const {
  watchGoogleCalendar,
  stopWatchGoogleCalendar,
} = require("../services/watchGoogleCalendar");
const {
  checkIfWatchIsSetup,
  setWatchSetup,
  removeWatchSetup,
  fetchWorkspacesToEnrich,
  fetchAttendeesToEnrich,
  fetchCurrentChannelId,
} = require("../utils/database");
const { loadClient } = require("../api/googleCalendar");
const { updateGoogleCal } = require("../api/googleCalendarApiClient");
const { enrichWorkspacesAndAttendees } = require("../api/dataEnrichment");

// Fetch the Google calendar for the initial sync
router.post("/", async (req, res) => {
  const { userId } = req.body;

  try {
    // Fetch the Google calendar data
    const meetingsData = await googleCalendarApiClient.getGoogleCal(userId);
    console.log("Meetings Data Length:", meetingsData.meetingsToUpdate.length);
    console.log(
      "attendeesToInsert Length:",
      meetingsData.attendeesToInsert.length
    );

    // Check if a Google Calendar watch is already set up
    const userResult = await checkIfWatchIsSetup(userId);

    if (userResult.isWatchSetup) {
      console.log("Watch is already set up, exiting set up watch function");
    }

    if (!userResult.isWatchSetup) {
      // Set up the Google Calendar watch
      await watchGoogleCalendar(userId);
      // Set the flag in the database indicating a watch is set up.
      await setWatchSetup(userId);
    }

    if (!userResult.initialEnrichmentComplete) {
      const workspacesToEnrich = await fetchWorkspacesToEnrich(
        userId,
        meetingsData
      );

      const enrichedWorkspacesAndAttendees = await enrichWorkspacesAndAttendees(
        workspacesToEnrich.uniqueWorkspaces,
        workspacesToEnrich.uniqueAttendees,
        userId
      );
    }

    // Create the response object
    const response = {
      workspace_id: meetingsData.workspace_id,
      meetings: meetingsData.meetings,
    };

    // stopWatch(userId);
    // console.log("response:", response);
    res.json(response); // Send the response including workspace_id and meetings data
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching meetings");
  }
});

// Update the meeting description endpoint - called by webhook on workspaces table
router.post("/update-meeting-description", async (req, res) => {
  // console.log(
  //   "update-meeting-description (from calendar link toggle) reqBody:",
  //   req.body
  // );
  const {
    workspace_id,
    collab_user_id,
    workspace_attendee_enable_calendar_link,
  } = req.body.record;

  try {
    await googleCalendarApiClient.updateMeetingDescription(
      workspace_id, // workspaceId
      collab_user_id, // userId
      workspace_attendee_enable_calendar_link // enableCalendarLink
    );
    res.status(200).send("Meeting Description Updated Successfully");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error updating meeting description");
  }
});

// Insert a Collab Space link into a new meeting when required - called by webhook on the meetings table
// router.post("/insert-link-for-new-meeting", async (req, res) => {
//   console.log("/insert-link-for-new-meeting called");
//   // Destructure information from the req.body
//   const { id, collab_user_id, workspace_id } = req.body.record;
//   // console.log(
//   //   "meetingId:",
//   //   id,
//   //   // "collab_user_id:",
//   //   // collab_user_id,
//   //   "workspace_id :",
//   //   workspace_id
//   // );

//   if (!workspace_id) {
//     // console.log("No workspace_id, exiting function");
//     return;
//   }

//   // Check if the workspace allows calendar links.
//   const { data: workspace, error } = await supabase
//     .from("workspaces")
//     .select("workspace_attendee_enable_calendar_link")
//     .eq("workspace_id", workspace_id)
//     .single();

//   console.log(
//     "workspace:",
//     workspace,
//     "enable calendar link:",
//     workspace.workspace_attendee_enable_calendar_link
//   );

//   if (error) {
//     console.error("Error querying workspace:", error);
//     throw new Error("Error querying the workspace.");
//   }

//   if (workspace.workspace_attendee_enable_calendar_link !== true) {
//     // console.log(
//     //   "Enable Calendar Links not set, or set to false, by user for workspace_id:",
//     //   workspace_id
//     // );
//     return;
//   }

//   console.log(
//     "workspace to have link inserted found for workspace ID:",
//     workspace_id
//   );

//   try {
//     await googleCalendarApiClient.enableCalendarLinkForNewMeeting(
//       id,
//       collab_user_id,
//       workspace_id
//     );

//     res.status(200).send({ success: "Link inserted for new meeting." });
//   } catch (error) {
//     console.error("Error inserting link for new meeting:", error);
//     res.status(500).send({ error: "Failed to insert link for new meeting." });
//   }
// });

// Webhook endpoint called by Google Calendar when there is a calendar change event
router.post("/google-calendar-watch", async (req, res) => {
  // Send 200 request recieved response
  res.sendStatus(200);

  // Retrieve the relevant header properties
  const resourceId = req.headers["x-goog-resource-id"];
  const channelToken = req.headers["x-goog-channel-token"];
  const channelId = req.headers["x-goog-channel-id"];
  // console.log(
  //   `&&&&&&&&&&&&&&&&&&& /google-calendar-watch endpoint called, here is the resourceId ${resourceId}, and the channelId ${channelId}`
  // );

  // If the X-Goog-Channel-Token header is missing or not formatted as expected, handle it gracefully
  if (!channelToken || !channelToken.includes("userId=")) {
    console.error("Invalid or missing X-Goog-Channel-Token");
    // Still respond with a 200 status to prevent Google from trying to resend the notification
    return;
  }

  // Extract the userId from the channel token
  const userId = channelToken.split("=")[1];

  const currentChannelId = await fetchCurrentChannelId(userId);

  // There is the possibility of duplicate endpoint calls - this if check ensures only the current channel
  // is being listened to before changing any data in the db
  if (currentChannelId === channelId) {
    console.log(`Channel Id's match - updating google calendar`);
    try {
      const updateStatus = await updateGoogleCal(userId);
      console.log("updateStatus:", updateStatus);
      // res.sendStatus(200);
    } catch (error) {
      console.error("Error in google calendar watch: ", error);
      if (
        error.response &&
        error.response.data &&
        error.response.data.error === "invalid_grant"
      ) {
        console.log("error.response.data.error", error.response.data.error);
        await deleteGoogCalTokens(userId);
      }
      res.sendStatus(500);
    }
  }
});

router.post("/stop-google-calendar-watch", async (req, res) => {
  const { userId } = req.body;

  try {
    // Stop the Google Calendar watch
    await stopWatchGoogleCalendar(userId);

    // Call removeWatchSetup to update the is_watch_setup flag
    // await removeWatchSetup(userId);

    res
      .status(200)
      .send({ message: "Google Calendar watch stopped successfully." });
  } catch (error) {
    console.error("Error stopping Google Calendar watch:", error);
    res.status(500).send({ error: "Failed to stop Google Calendar watch." });
  }
});

module.exports = router;
