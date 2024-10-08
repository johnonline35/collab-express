const { loadClient } = require("../api/googleCalendar");
const { v4: uuidv4 } = require("uuid");
const { railwayCalendarWatchEndpoint } = require("../data/collabUrls");
const {
  getUserEmailFromDB,
  loadSyncTokenForUser,
  saveGoogleCalendarWatchDetailsForUser,
  fetchGoogleCalendarWatchDetailsForUser,
} = require("../utils/database");
const { deleteGoogCalTokens } = require("../utils/database");
const tokenExpiryQueue = require("./tokenExpiryQueue");

async function watchGoogleCalendar(userId) {
  const userEmail = await getUserEmailFromDB(userId);
  const calendar = await loadClient(userId);
  const ttl = 604800000;

  const syncToken = await loadSyncTokenForUser(userId);

  let requestBody = {
    id: uuidv4(), // id for the channel; unique for each watch request
    type: "web_hook",
    address: railwayCalendarWatchEndpoint, // your webhook
    token: `userId=${userId}`, // token carrying the userId
    params: {
      ttl: ttl.toString(),
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

  console.log("Google Calendar watch set up successfully");

  const resourceId = res.data.resourceId;
  const channelId = res.data.id;

  await saveGoogleCalendarWatchDetailsForUser(userId, resourceId, channelId);

  // Remove the channelId and resourceId tokena once the expiration time is reached
  tokenExpiryQueue.add(
    "checkTokenExpiry",
    { userId: userId },
    {
      delay: ttl,
      attempts: 3,
    }
  );
}

async function stopWatchGoogleCalendar(userId) {
  const watchDetails = await fetchGoogleCalendarWatchDetailsForUser(userId);
  if (!watchDetails) {
    console.error("No watch details found for user", userId);
    return;
  }

  const { resourceId, channelId } = watchDetails;
  const calendar = await loadClient(userId);

  console.log(
    `Stopping google calendar watch for channelId: ${channelId} and resourceId: ${resourceId}`
  );

  const res = await calendar.channels.stop({
    requestBody: {
      // The channel id and resource id of the subscription to stop.
      id: channelId,
      resourceId: resourceId,
    },
  });

  console.log(`Response status from stop goog cal watch: ${res.status}`);

  if (res.status === 204 || !res.status) {
    // 204 is the typical HTTP status code for a successful delete operation.
    // Clear the channelId and resourceId in the database
    const confirmDbTokenDeletion = await deleteGoogCalTokens(userId);
  }
}

module.exports = {
  watchGoogleCalendar,
  stopWatchGoogleCalendar,
};
