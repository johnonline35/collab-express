const supabase = require("../db/supabase");

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

module.exports = {
  getRefreshTokenFromDB,
  getUserEmailFromDB,
  checkIfWatchIsSetup,
  setWatchSetup,
};
