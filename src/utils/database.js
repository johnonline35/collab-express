const supabase = require("../db/supabase");

// Save the syncToken for a user
async function saveSyncTokenForUser(userId, syncToken) {
  const { data, error } = await supabase
    .from("collab_users")
    .update({ sync_token: syncToken })
    .eq("id", userId);

  if (error) {
    console.error("Error saving syncToken:", error);
    return false;
  }

  return true;
}

// Load the syncToken for a user
async function loadSyncTokenForUser(userId) {
  const { data, error } = await supabase
    .from("collab_users")
    .select("sync_token")
    .eq("id", userId);

  if (error) {
    console.error("Error loading syncToken:", error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0].sync_token;
}

// Update the timezone for a user
async function saveUserTimeZone(userId, timeZone) {
  const { data, error } = await supabase
    .from("collab_users")
    .update({ collab_user_timezone: timeZone })
    .eq("id", userId);

  if (error) {
    console.error("Error saving user time zone:", error);
    return false;
  }

  return true;
}

const getRefreshTokenFromDB = async (userId) => {
  const { data, error } = await supabase
    .from("collab_users")
    .select("refresh_token")
    .eq("id", userId);

  if (error) {
    console.error("Error fetching refresh token:", error);
    return null;
  }

  return data[0].refresh_token;
};

const getUserEmailFromDB = async (userId) => {
  const { data, error } = await supabase
    .from("collab_users")
    .select("collab_user_email")
    .eq("id", userId);

  if (error) {
    console.error("Error fetching user email:", error);
    return null;
  }

  return data[0].collab_user_email;
};

const checkIfWatchIsSetup = async (userId) => {
  const { data, error } = await supabase
    .from("collab_users")
    .select("is_watch_setup")
    .eq("id", userId);

  if (error) {
    console.error("Error fetching watch status:", error);
    return false;
  }

  // If the field is null or undefined, consider the watch as not set up
  return data[0].is_watch_setup || false;
};

const setWatchSetup = async (userId) => {
  const { error } = await supabase
    .from("collab_users")
    .update({ is_watch_setup: true })
    .eq("id", userId);

  if (error) {
    console.error("Error setting watch setup:", error);
    throw error;
  }
};

// Save the resourceId and channelId for a user
async function saveGoogleCalendarWatchDetailsForUser(
  userId,
  resourceId,
  channelId
) {
  const { error } = await supabase
    .from("collab_users")
    .update({
      goog_cal_resource_id: resourceId,
      goog_cal_channel_id: channelId,
    })
    .eq("id", userId);

  if (error) {
    console.error("Error saving Google Calendar watch details:", error);
    return false;
  }

  return true;
}

// Fetch the resourceId and channelId for a user
async function fetchGoogleCalendarWatchDetailsForUser(userId) {
  const { data, error } = await supabase
    .from("collab_users")
    .select("goog_cal_resource_id, goog_cal_channel_id")
    .eq("id", userId);

  if (error) {
    console.error("Error fetching Google Calendar watch details:", error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return {
    resourceId: data[0].goog_cal_resource_id,
    channelId: data[0].goog_cal_channel_id,
  };
}

module.exports = {
  getRefreshTokenFromDB,
  getUserEmailFromDB,
  checkIfWatchIsSetup,
  setWatchSetup,
  saveSyncTokenForUser,
  loadSyncTokenForUser,
  saveUserTimeZone,
  saveGoogleCalendarWatchDetailsForUser,
  fetchGoogleCalendarWatchDetailsForUser,
};
