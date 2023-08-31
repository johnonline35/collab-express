const express = require("express");
const router = express.Router();
const googleCalendarApiClient = require("../api/googleCalendarApiClient");
const { watchGoogleCalendar } = require("../services/watchGoogleCalendar");
const { checkIfWatchIsSetup, setWatchSetup } = require("../utils/database");
const { loadClient } = require("../api/googleCalendar");
const { updateGoogleCal } = require("../api/googleCalendarApiClient");

// Fetch the Google calendar for the initial sync
router.post("/", async (req, res) => {
  const { userId } = req.body;
  console.log(userId); // Log the userId sent from your getMeetings function

  try {
    // Fetch the Google calendar data
    const meetingsData = await googleCalendarApiClient.getGoogleCal(userId);

    // Check if a Google Calendar watch is already set up
    const isWatchSetup = await checkIfWatchIsSetup(userId);

    if (isWatchSetup) {
      console.log("Watch is already set up, exiting set up watch function");
    }

    if (!isWatchSetup) {
      // Set up the Google Calendar watch
      await watchGoogleCalendar(userId);
      // Set the flag database indicating a watch is set up
      await setWatchSetup(userId);
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

// Update the meeting description endpoint
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

// Insert a Collab Space link into a new meeting when required
router.post("/insert-link-for-new-meeting", async (req, res) => {
  console.log("/insert-link-for-new-meeting req.body:", req.body);
  // Destructure information from the req.body
  const { meetingId, userId, workspaceId } = req.body.record;

  try {
    await googleCalendarApiClient.enableCalendarLinkForNewMeeting(
      meetingId,
      userId,
      workspaceId
    );

    res.status(200).send({ success: "Link inserted for new meeting." });
  } catch (error) {
    console.error("Error inserting link for new meeting:", error);
    res.status(500).send({ error: "Failed to insert link for new meeting." });
  }
});

// Webhook endpoint called by Google Calendar when there is a calendar change event
router.post("/google-calendar-watch", async (req, res) => {
  const reqHeaders = req.headers;
  const resourceId = req.headers["x-goog-resource-id"];
  const channelToken = req.headers["x-goog-channel-token"];
  const channelId = req.headers["x-goog-channel-id"];
  // console.log("Called Google calendar watch endpoint reqHeaders", reqHeaders);
  console.log("Called Google calendar watch endpoint channelId", channelId);
  console.log("Called Google calendar watch endpoint resourceId", resourceId);
  console.log(
    "Called Google calendar watch endpoint channelToken",
    channelToken
  );

  // If the X-Goog-Channel-Token header is missing or not formatted as expected, handle it gracefully
  if (!channelToken || !channelToken.includes("userId=")) {
    console.error("Invalid or missing X-Goog-Channel-Token");
    // Still respond with a 200 status to prevent Google from trying to resend the notification
    res.sendStatus(200);
    return;
  }

  // Extract the userId from the channel token
  const userId = channelToken.split("=")[1];
  console.log("google-calendar-watch userId:", userId);

  try {
    const updateStatus = await updateGoogleCal(userId);
    console.log("updateStatus:", updateStatus);
    res.sendStatus(200);
  } catch (error) {
    console.error("Error in google calendar watch: ", error);
    res.sendStatus(500);
  }
});

module.exports = router;
