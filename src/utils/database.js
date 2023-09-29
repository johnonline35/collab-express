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

const removeWatchSetup = async (userId) => {
  const { error } = await supabase
    .from("collab_users")
    .update({ is_watch_setup: false })
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

async function fetchAllAttendeeInfos(attendees) {
  const attendeeInfos = [];
  for (let attendee of attendees) {
    const attendeeInfo = await fetchAttendeeData(attendee.attendee_email);
    attendeeInfos.push(attendeeInfo);
  }
  return attendeeInfos;
}

async function fetchAttendeeData(attendeeEmail) {
  try {
    const fetchUserId = supabase
      .from("pdl_api_users")
      .select("id")
      .eq("email_address_collab_key", attendeeEmail);

    const [usersResponse] = await Promise.all([fetchUserId]);

    if (!usersResponse.data || usersResponse.data.length === 0) {
      throw new Error(`User not found for email: ${attendeeEmail}`);
    }

    const userId = usersResponse.data[0].id;

    const fetchExperience = supabase
      .from("pdl_api_experience")
      .select("company_name, company_size, title_name, start_date, end_date")
      .eq("user_id", userId);

    const fetchEducation = supabase
      .from("pdl_api_education")
      .select("school_name, degree, major, start_date, end_date")
      .eq("user_id", userId);

    const [experienceResponse, educationResponse] = await Promise.all([
      fetchExperience,
      fetchEducation,
    ]);

    return {
      experience: experienceResponse.data,
      education: educationResponse.data,
    };
  } catch (error) {
    console.error(`Failed to fetch data for email: ${attendeeEmail}`, error);
    throw error;
  }
}

async function enrichWorkspaces(userId) {
  try {
    // 1. Fetch meetings based on userId
    let { data: meetings, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("collab_user_id", userId)
      // .gte("start_dateTime", new Date().toISOString())
      // .order("start_dateTime", { ascending: true })
      .limit(10);

    if (error) {
      throw error;
    }

    // Extract workspace_ids from the meetings
    const workspaceIds = meetings.map((meeting) => meeting.workspace_id);
    console.log("workspaceIds:", workspaceIds);

    // 2. Update workspaces table
    const { data, error: updateError } = await supabase
      .from("workspaces")
      .in("workspace_id", workspaceIds)
      .update({
        enrich_and_display: true,
      });

    if (updateError) {
      throw updateError;
    }

    return null;
  } catch (err) {
    console.error("Error while fetching and updating:", err);
    return null;
  }
}

module.exports = {
  getRefreshTokenFromDB,
  getUserEmailFromDB,
  checkIfWatchIsSetup,
  setWatchSetup,
  removeWatchSetup,
  saveSyncTokenForUser,
  loadSyncTokenForUser,
  saveUserTimeZone,
  saveGoogleCalendarWatchDetailsForUser,
  fetchGoogleCalendarWatchDetailsForUser,
  fetchAllAttendeeInfos,
  fetchAttendeeData,
  enrichWorkspaces,
};
