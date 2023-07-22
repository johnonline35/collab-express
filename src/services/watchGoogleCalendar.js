const { loadClient } = require("../api/googleCalendar");
const { getUserEmailFromDB } = require("../utils/database");
const { v4: uuidv4 } = require("uuid");
const { railwayCalendarWatchEndpoint } = require("../data/collabUrls");

async function watchGoogleCalendar(userId) {
  const userEmail = await getUserEmailFromDB(userId);
  const calendar = await loadClient(userId);

  const res = await calendar.events.watch({
    calendarId: userEmail, // the user's email address serves as the calendarId
    requestBody: {
      id: uuidv4(), // id for the channel; unique for each watch request
      type: "web_hook",
      address: railwayCalendarWatchEndpoint, // your webhook
      params: {
        ttl: "432000000", // time to live in seconds; adjust as needed
      },
    },
  });

  if (res.status !== 200) {
    console.error("Failed to set up watch", res);
    throw new Error("Failed to set up Google Calendar watch");
  }

  console.log("Google Calendar watch set up successfully", res.data);
}

module.exports = {
  watchGoogleCalendar,
};
