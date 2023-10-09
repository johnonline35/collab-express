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
    .select("*")
    .eq("id", userId);

  if (error) {
    console.error("Error fetching user data:", error);
    return {
      isWatchSetup: false,
      initialEnrichmentComplete: false,
    };
  }

  // If the field is null or undefined, consider the watch as not set up
  return {
    isWatchSetup: data[0].is_watch_setup || false,
    initialEnrichmentComplete: data[0].initial_enrichment_complete || false,
  };
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

async function fetchWorkspacesToEnrich(userId, meetingsData) {
  // console.log(
  //   "Just called: fetchWorkspacesToEnrich here is the meetingsData:",
  //   meetingsData
  // );

  const sortWorkspaceIds = function () {
    const currentDateTimestamp = new Date().getTime();

    let uniqueWorkspaceIds = [];

    meetingsData.meetingsToUpdate.sort(
      (a, b) =>
        new Date(a.start_dateTime).getTime() -
        new Date(b.start_dateTime).getTime()
    );

    // console.log(
    //   "Sorted meetingsData.meetingsToUpdate:",
    //   meetingsData.meetingsToUpdate
    // );

    for (let meeting of meetingsData.meetingsToUpdate) {
      if (
        new Date(meeting.start_dateTime).getTime() > currentDateTimestamp &&
        !uniqueWorkspaceIds.includes(meeting.workspace_id)
      ) {
        uniqueWorkspaceIds.push(meeting.workspace_id);
        if (uniqueWorkspaceIds.length === 10) break;
      }
    }

    if (uniqueWorkspaceIds.length < 10) {
      for (let i = meetingsData.meetingsToUpdate.length - 1; i >= 0; i--) {
        let meeting = meetingsData.meetingsToUpdate[i];
        if (
          new Date(meeting.start_dateTime).getTime() <= currentDateTimestamp &&
          !uniqueWorkspaceIds.includes(meeting.workspace_id)
        ) {
          uniqueWorkspaceIds.push(meeting.workspace_id);
          if (uniqueWorkspaceIds.length === 10) break;
        }
      }
    }

    return uniqueWorkspaceIds;
  };

  // Refactored for Linear Time: (O ( n + m )):
  const sortAttendees = function () {
    let attendeesForWorkspaces = [];
    const workspaceIdsSet = new Set(workspaceIds);

    for (let attendee of meetingsData.attendeesToInsert) {
      if (workspaceIdsSet.has(attendee.workspace_id)) {
        attendeesForWorkspaces.push(attendee);
      }
    }

    return attendeesForWorkspaces;
  };

  const workspaceIds = sortWorkspaceIds();
  console.log("***workspaceIds LENGTH***", workspaceIds.length);
  const uniqueAttendees = sortAttendees();
  console.log("***uniqueAttendees LENGTH***", uniqueAttendees.length);

  try {
    let uniqueWorkspaces = [];
    const { data: updatedData, error: updateError } = await supabase
      .from("workspaces")
      .update({ enrich_and_display: true }, { returning: "minimal" })
      .in("workspace_id", workspaceIds)
      .select();

    if (updateError) {
      throw updateError;
    }
    uniqueWorkspaces = updatedData;

    return {
      uniqueWorkspaces: uniqueWorkspaces,
      uniqueAttendees: uniqueAttendees,
    };
  } catch (err) {
    console.error("Error while fetching and updating:", err);
    return [];
  }
}

// async function fetchWorkspacesToEnrich(userId, meetingsData) {
//   console.log("Just called: fetchWorkspacesToEnrich");
//   const currentDate = new Date().toISOString();

//   function isValidUUID(v) {
//     const regex =
//       /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
//     return v && regex.test(v);
//   }

//   try {
//     // 1. Fetch future meetings based on userId
//     let { data: futureMeetings } = await supabase
//       .from("meetings")
//       .select("*")
//       .eq("collab_user_id", userId)
//       .gte("start_dateTime", currentDate)
//       .order("start_dateTime", { ascending: true });
//     // .limit(100);

//     // console.log("Future meetings array:", futureMeetings);

//     let uniqueWorkspaceIds = [];

//     // Extract unique workspace_ids from future meetings
//     for (let meeting of futureMeetings) {
//       if (
//         !uniqueWorkspaceIds.includes(meeting.workspace_id) &&
//         isValidUUID(meeting.workspace_id)
//       ) {
//         uniqueWorkspaceIds.push(meeting.workspace_id);
//         if (uniqueWorkspaceIds.length >= 10) {
//           break;
//         }
//       }
//     }

//     // If there are not 10 unique workspaces from future meetings, fetch past meetings to make up the difference
//     if (uniqueWorkspaceIds.length < 10) {
//       let { data: pastMeetings } = await supabase
//         .from("meetings")
//         .select("*")
//         .eq("collab_user_id", userId)
//         .lt("start_dateTime", currentDate)
//         .order("start_dateTime", { ascending: false })
//         .limit(100);

//       for (let meeting of pastMeetings) {
//         if (
//           !uniqueWorkspaceIds.includes(meeting.workspace_id) &&
//           isValidUUID(meeting.workspace_id)
//         ) {
//           uniqueWorkspaceIds.push(meeting.workspace_id);
//           if (uniqueWorkspaceIds.length >= 10) {
//             break;
//           }
//         }
//       }
//     }
//     // console.log("uniqueWorkspaceIds:", uniqueWorkspaceIds);
//     // 2. Update workspaces table
//     let updatedWorkspaces = [];
//     const { data: updatedData, error: updateError } = await supabase
//       .from("workspaces")
//       .update({ enrich_and_display: true }, { returning: "minimal" })
//       .in("workspace_id", uniqueWorkspaceIds)
//       .select();

//     if (updateError) {
//       throw updateError;
//     }
//     updatedWorkspaces = updatedData;

//     // console.log("updatedWorkspaces:", updatedWorkspaces);
//     return updatedWorkspaces; // Return the updated workspaces
//   } catch (err) {
//     console.error("Error while fetching and updating:", err);
//     return [];
//   }
// }

async function fetchAttendeesToEnrich(userId, workspacesToEnrich) {
  // console.log(
  //   `Just called fetchAttendeesToEnrich with userId: ${userId}, and workspace object: ${workspacesToEnrich}`
  // );
  try {
    // Extract workspace_ids from workspacesToEnrich
    const workspaceIds = workspacesToEnrich.map(
      (workspace) => workspace.workspace_id
    );

    // Fetch attendees based on workspaceIds and userId
    const { data: attendees, error } = await supabase
      .from("attendees")
      .select("*")
      .in("workspace_id", workspaceIds)
      .eq("collab_user_id", userId);

    if (error) {
      throw error;
    }

    // console.log("Fetched attendees:", attendees);

    return attendees;
  } catch (err) {
    console.error("Error while fetching attendees:", err);
    return null;
  }
}

async function updateInitialEnrichmentComplete(userId) {
  try {
    const { error } = await supabase
      .from("collab_users")
      .update({ initial_enrichment_complete: true })
      .eq("id", userId);

    if (error) {
      throw error;
    }
    return true;
  } catch (err) {
    console.error("Error updating initial_enrichment_complete:", err);
    return false;
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
  fetchWorkspacesToEnrich,
  fetchAttendeesToEnrich,
  updateInitialEnrichmentComplete,
};
