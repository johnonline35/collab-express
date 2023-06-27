const express = require("express");
const router = express.Router();
const googleCalendarApiClient = require("../api/googleCalendarApiClient");

router.post("/", async (req, res) => {
  const { userId } = req.body;
  console.log(userId); // Log the userId sent from your getMeetings function
  try {
    const meetingsData = await googleCalendarApiClient.getGoogleCal(userId); // Pass userId to your getGoogleCal function

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

    console.log("response:", response);
    res.json(response); // Send the response including workspace_id and meetings data
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching meetings");
  }
});

module.exports = router;

// const express = require("express");
// const router = express.Router();
// const googleCalendarApiClient = require("../api/googleCalendarApiClient");

// router.post("/", async (req, res) => {
//   const { userId } = req.body;
//   console.log(userId); // Log the userId sent from your getMeetings function
//   try {
//     const meetings = await googleCalendarApiClient.getGoogleCal(userId); // Pass userId to your getGoogleCal function
//     res.json(meetings); // Send meetings data as the response
//   } catch (error) {
//     console.error(error);
//     res.status(500).send("Error fetching meetings");
//   }
// });

// module.exports = router;
