const express = require("express");
const router = express.Router();
const { googleCalendarApiClient } = require("../api/googleCalendarApiClient");

router.post("/", async (req, res) => {
  const { userId } = req.body;
  console.log(userId); // Log the userId sent from your getMeetings function
  const meetings = await googleCalendarApiClient.getGoogleCal(userId); // Pass userId to your getGoogleCal function
  res.send("Received your request!");
});

module.exports = router;
