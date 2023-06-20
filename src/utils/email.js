const supabase = require("../services/database");

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

module.exports = {
  getRefreshTokenFromDB,
  getUserEmailFromDB,
  // export other functions here
};
