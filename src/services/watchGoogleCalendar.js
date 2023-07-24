const { loadClient } = require("../api/googleCalendar");
const { getUserEmailFromDB } = require("../utils/database");
const { v4: uuidv4 } = require("uuid");
const { railwayCalendarWatchEndpoint } = require("../data/collabUrls");
const { loadSyncTokenForUser } = require("../utils/database");

async function watchGoogleCalendar(userId) {
  const userEmail = await getUserEmailFromDB(userId);
  const calendar = await loadClient(userId);

  const syncToken = await loadSyncTokenForUser(userId);

  let requestBody = {
    id: uuidv4(), // id for the channel; unique for each watch request
    type: "web_hook",
    address: railwayCalendarWatchEndpoint, // your webhook
    token: "target=myApp-myCalendarChannelDest", // token carrying the userId
    params: {
      ttl: "604800000", // time to live in seconds; adjust as needed
    },
  };

  if (syncToken) {
    requestBody.params.syncToken = syncToken;
  }

  const res = await calendar.events.watch({
    calendarId: userEmail, // the user's email address serves as the calendarId
    requestBody: requestBody,
  });

  if (res.status !== 200) {
    console.error("Failed to set up watch", res);
    throw new Error("Failed to set up Google Calendar watch");
  }

  console.log("Google Calendar watch set up successfully", res.data);
  //, res.data
}

module.exports = {
  watchGoogleCalendar,
};

// Looking at your logs, it seems like your watchGoogleCalendar function and getGoogleCal function are successfully executing. The logs show the Google Calendar watch set up successfully message and a list of meeting data obtained from the Google Calendar API.

// However, the workspace_id is coming up as undefined in your meeting objects. This might be because the workspace_id is not available in the Google Calendar event data. You might want to check how you're obtaining or assigning workspace_id.

// Here's a potential issue:

// If the workspace_id is not part of the original Google Calendar event data, you may need to have some kind of mapping between the Google Calendar events and your internal concept of a workspace. This might be something that you manage in your own database.

// You could map a user (or a user's Google account) to a workspace in your system, and when you fetch events from their Google Calendar, you can add the workspace_id to the event data on your side, before sending the response.

// If workspace_id is supposed to be a part of the Google Calendar event data (perhaps in the event description or another field), make sure the workspace_id is correctly included and retrieved from the Google Calendar event data.

// Given the log output, it seems like there might be a disconnection or an error in how you're assigning or fetching the workspace_id. Please verify and correct that.
