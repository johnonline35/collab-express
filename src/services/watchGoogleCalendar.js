const { loadClient } = require("../api/googleCalendar");
const { v4: uuidv4 } = require("uuid");
const { railwayCalendarWatchEndpoint } = require("../data/collabUrls");
const {
  getUserEmailFromDB,
  loadSyncTokenForUser,
  saveGoogleCalendarWatchDetailsForUser,
  fetchGoogleCalendarWatchDetailsForUser,
} = require("../utils/database");

async function watchGoogleCalendar(userId) {
  const userEmail = await getUserEmailFromDB(userId);
  const calendar = await loadClient(userId);

  const syncToken = await loadSyncTokenForUser(userId);

  let requestBody = {
    id: uuidv4(), // id for the channel; unique for each watch request
    type: "web_hook",
    address: railwayCalendarWatchEndpoint, // your webhook
    token: `userId=${userId}`, // token carrying the userId
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

  console.log("Google Calendar watch set up successfully");

  const resourceId = res.data.resourceId;
  const channelId = res.data.id;

  await saveGoogleCalendarWatchDetailsForUser(userId, resourceId, channelId);
}

async function stopWatchGoogleCalendar(userId) {
  const watchDetails = await fetchGoogleCalendarWatchDetailsForUser(userId);
  if (!watchDetails) {
    console.error("No watch details found for user", userId);
    return;
  }

  const { resourceId, channelId } = watchDetails;
  const calendar = await loadClient(userId);

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
    const { error } = await supabase
      .from("collab_users")
      .update({
        goog_cal_resource_id: null,
        goog_cal_channel_id: null,
      })
      .eq("id", userId);

    if (error) {
      console.error("Error clearing Google Calendar watch details:", error);
    }
  }
}

// async function stopWatchGoogleCalendar(userId) {
//   const watchDetails = await fetchGoogleCalendarWatchDetailsForUser(userId);
//   if (!watchDetails) {
//     console.error("No watch details found for user", userId);
//     return;
//   }

//   const { resourceId, channelId } = watchDetails;
//   const calendar = await loadClient(userId);

//   const res = await calendar.channels.stop({
//     requestBody: {
//       // The channel id and resource id of the subscription to stop.
//       id: channelId,
//       resourceId: resourceId,
//     },
//   });

//   console.log("stopWatch:", res);
// }

module.exports = {
  watchGoogleCalendar,
  stopWatchGoogleCalendar,
};
