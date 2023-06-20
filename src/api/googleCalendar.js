const { google } = require("googleapis");
const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URL } = require("../config");
const { getRefreshTokenFromDB } = require("../utils/email");

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URL
);

const loadClient = async (userId) => {
  const token = await getRefreshTokenFromDB(userId);
  oauth2Client.setCredentials({ refresh_token: token });
  return google.calendar({ version: "v3", auth: oauth2Client });
};

module.exports = {
  loadClient,
};
