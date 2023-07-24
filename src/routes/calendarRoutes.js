const express = require("express");
const router = express.Router();
const googleCalendarApiClient = require("../api/googleCalendarApiClient");
const { watchGoogleCalendar } = require("../services/watchGoogleCalendar");
const { checkIfWatchIsSetup, setWatchSetup } = require("../utils/database");

// Fetch the Google calendar api endpoint
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
      meetings: meetingsData.meetings.map((meeting) => {
        return {
          ...meeting,
          workspace_id: meeting.workspace_id || meetingsData.workspace_id,
        };
      }),
    };

    // console.log("response:", response);
    res.json(response); // Send the response including workspace_id and meetings data
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching meetings");
  }
});

// router.post("/", async (req, res) => {
//   const { userId } = req.body;
//   console.log(userId);
//   try {
//     const meetingsData = await googleCalendarApiClient.getGoogleCal(userId);

//     // Create the response object
//     const response = {
//       workspace_id: meetingsData.workspace_id,
//       meetings: meetingsData.meetings.map((meeting) => {
//         return {
//           ...meeting,
//           workspace_id: meeting.workspace_id || meetingsData.workspace_id,
//         };
//       }),
//     };

//     console.log("response:", response);
//     res.json(response); // Send the response including workspace_id and meetings data
//   } catch (error) {
//     console.error(error);
//     res.status(500).send("Error fetching meetings");
//   }
// });

// Update the meeting description endpoint
router.post("/update-meeting-description", async (req, res) => {
  console.log(
    "update-meeting-description (from calendar link toggle) reqBody:",
    req.body
  );
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

// Webhook endpoint called by Google Calendar when there is a calendar change event
router.post("/google-calendar-watch", async (req, res) => {
  const resourceId = req.headers["x-goog-resource-id"];
  console.log("Called Google calendar watch endpoint", resourceId, req);
  // const userId = await getUserIdByResourceId(resourceId);
  // const meetingsData = await getGoogleCal(userId);
  // Insert/update these meetings data into your database

  // Here you should fetch this event from the Google Calendar API and update your database accordingly.

  // For example, you can fetch the userId related to this resourceId,
  // then call your existing googleCalendarApiClient.getGoogleCal function to refresh the data

  // Remember to handle the error properly
  // try {
  //   const userId = await getUserIdByResourceId(resourceId); // You should implement this function
  //   // Insert/update these meetings data into your database

  //   res.sendStatus(200);
  // } catch (error) {
  //   console.error("Error in google calendar watch: ", error);
  //   res.sendStatus(500);
  // }
});

module.exports = router;
