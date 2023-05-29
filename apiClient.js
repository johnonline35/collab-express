require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const { google } = require("googleapis");
const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const redirect_url = "https://collab-express-production.up.railway.app/";

const Bottleneck = require("bottleneck");
const limiter = new Bottleneck({
  minTime: 100, // Adjust this value based on your rate limits
});

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const publicEmailDomains = require("./listOfEmailDomains.js");

const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_url
);

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

const loadClient = async (userId) => {
  const token = await getRefreshTokenFromDB(userId);
  oauth2Client.setCredentials({ refresh_token: token });
  return google.calendar({ version: "v3", auth: oauth2Client });
};

// FETCH MEETINGS FROM GOOGLE CALENDAR
const getGoogleCal = async (userId) => {
  console.log(userId);
  const calendar = await loadClient(userId);

  // Fetch user email from database
  const userEmail = await getUserEmailFromDB(userId);
  if (!userEmail) {
    console.error("Error: User email not found");
    return [];
  } else {
    console.log("userEmail", userEmail);
  }

  const now = new Date();
  const twentyFourMonthsAgo = new Date(now.getTime());
  twentyFourMonthsAgo.setMonth(now.getMonth() - 1);
  const timeMin = twentyFourMonthsAgo.toISOString();

  const twoMonthsFromNow = new Date(now.getTime());
  twoMonthsFromNow.setMonth(now.getMonth() + 2);
  const timeMax = twoMonthsFromNow.toISOString();

  let allEvents = [];
  let nextPageToken = undefined;

  try {
    do {
      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin: timeMin,
        timeMax: timeMax,
        singleEvents: true,
        orderBy: "startTime",
        pageToken: nextPageToken,
      });

      allEvents = allEvents.concat(response.data.items);
      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

    const meetings = allEvents.filter(
      (event) =>
        event.attendees &&
        event.attendees.length > 1 &&
        event.attendees.length < 11
    );

    // Insert data into the database for each meeting
    const upsertPromises = meetings.map(async (meeting) => {
      const attendees = meeting.attendees.filter(
        (attendee) => attendee.email !== "johnchildseddy@gmail.com" // change this to userEmail
      );

      const meetingData = {
        id: meeting.id,
        summary: meeting.summary,
        creator_email: meeting.creator.email,
        organizer_email: meeting.organizer.email,
        start_dateTime: meeting.start.dateTime,
        end_dateTime: meeting.end.dateTime,
      };

      try {
        console.log("Upserting meeting data:", meetingData);
        // Wait for the meeting upsert to complete before upserting attendees
        const { data: upsertMeetingData, error: upsertMeetingError } =
          await limiter.schedule(() =>
            supabase
              .from("meetings")
              .upsert([meetingData], { returning: "minimal" })
          );

        if (upsertMeetingError) {
          console.error("Upsert Meeting Error:", upsertMeetingError);
          return;
        }

        console.log("Upsert Meeting Data:", upsertMeetingData);

        // Now that the meeting has been upserted, upsert attendees
        await Promise.all(
          attendees.map(async (attendee) => {
            const { data: upsertAttendeeData, error: upsertAttendeeError } =
              await limiter.schedule(() =>
                supabase.from("meeting_attendees").upsert(
                  [
                    {
                      meeting_id: meeting.id,
                      email: attendee.email,
                      organizer: attendee.organizer || false,
                      response_status: attendee.responseStatus,
                    },
                  ],
                  { returning: "minimal" }
                )
              );

            if (upsertAttendeeError) {
              console.error("Upsert Attendee Error:", upsertAttendeeError);
            } else {
              console.log("Upsert Attendee Data:", upsertAttendeeData);
            }
          })
        );
      } catch (error) {
        console.error("Upsert process error:", error);
      }
    });

    await Promise.all(upsertPromises);

    // Log filtered meetings
    // console.log(JSON.stringify(meetings, null, 2));

    return meetings;
  } catch (error) {
    console.error("The API returned an error:", error);
    return [];
  }
};

// Fetch future meetings
const fetchFutureMeetings = async () => {
  console.log("fetchFutureMeetings called");
  try {
    let { data: futureMeetings, error } = await supabase
      .from("meetings")
      .select("id")
      .gte("start_dateTime", new Date().toISOString())
      .order("start_dateTime", { ascending: true })
      .limit(8);

    if (error) {
      console.error("Error fetching future meetings:", error);
      return [];
    }

    return futureMeetings;
  } catch (error) {
    console.error("Error in fetchFutureMeetings:", error);
    return [];
  }
};

// Fetch past meetings
const fetchPastMeetings = async (currentMeetingsCount) => {
  console.log("fetchPastMeetings called");
  try {
    let { data: pastMeetings, error } = await supabase
      .from("meetings")
      .select("id")
      .lt("start_dateTime", new Date().toISOString())
      .order("start_dateTime", { ascending: false }) // Ordering by descending to get most recent past meetings
      .limit(8 - currentMeetingsCount); // Fetch the remaining number of meetings to reach 8

    if (error) {
      console.error("Error fetching past meetings:", error);
      return [];
    }

    return pastMeetings;
  } catch (error) {
    console.error("Error in fetchPastMeetings:", error);
    return [];
  }
};

// Fetch meeting details
const fetchMeetingDetails = async (meetingId) => {
  console.log("fetchMeetingDetails called");
  try {
    let { data: meetingDetails, error } = await supabase
      .from("meetings")
      .select("creator_email, organizer_email")
      .eq("id", meetingId);

    if (error) {
      console.error(
        `Error fetching meeting details for meeting id: ${meetingId}:`,
        error
      );
      return null;
    }

    return meetingDetails;
  } catch (error) {
    console.error("Error in fetchMeetingDetails:", error);
    return null;
  }
};

// Fetch meeting attendees
const fetchMeetingAttendees = async (meetingId) => {
  console.log("fetchMeetingAttendees called");
  try {
    let { data: attendees, error } = await supabase
      .from("meeting_attendees")
      .select("email")
      .eq("meeting_id", meetingId);

    if (error) {
      console.error(
        `Error fetching attendees for meeting id: ${meetingId}:`,
        error
      );
      return [];
    }

    return attendees;
  } catch (error) {
    console.error("Error in fetchMeetingAttendees:", error);
    return [];
  }
};

// NEW FILTER FOR EMAIL AND DOMAIN
// const filterCollabUserEmails = async (emails) => {
//   const publicEmailDomains = require("./listOfEmailDomains.js");

//   const getDomain = (email) => email.split("@")[1];

//   try {
//     let filteredEmails = await Promise.all(
//       emails.map(async (email) => {
//         const domain = getDomain(email);

//         if (publicEmailDomains.includes(domain)) {
//           let { data: collabUsers, error } = await supabase
//             .from("collab_users")
//             .select("collab_user_email")
//             .eq("collab_user_email", email);

//           if (error) {
//             console.error("Error checking collab_users:", error);
//             return email; // In case of error, include the email
//           }

//           // If the email doesn't match with any collab_user_email, include it
//           if (collabUsers.length === 0) {
//             return email;
//           }

//           // If the email matches with a collab_user_email, exclude it
//           return null;
//         } else {
//           const attendeesDomains = emails.map(getDomain);
//           const uniqueDomains = [...new Set(attendeesDomains)];

//           // If all attendees are from the same domain, filter out the email
//           if (uniqueDomains.length === 1) {
//             return null;
//           }

//           // If there are attendees from different domains, include the email
//           return email;
//         }
//       })
//     );

//     // Remove null values from the filteredEmails array
//     return filteredEmails.filter((email) => email !== null);
//   } catch (error) {
//     console.error("Error filtering emails:", error);
//     return emails; // In case of error, return the original list of emails
//   }
// };

// Filter collab user emails
const filterCollabUserEmails = async (emails) => {
  try {
    let filteredEmails = await Promise.all(
      emails.map(async (email) => {
        let { data: collabUsers, error } = await supabase
          .from("collab_users")
          .select("collab_user_email")
          .eq("collab_user_email", email);

        if (error) {
          console.error("Error checking collab_users:", error);
          return email; // In case of error, include the email
        }

        // If the email doesn't match with any collab_user_email, include it
        if (collabUsers.length === 0) {
          return email;
        }

        // If the email matches with a collab_user_email, exclude it
        return null;
      })
    );

    // Remove any null values (which correspond to matching collab_user_emails)
    filteredEmails = filteredEmails.filter((email) => email !== null);

    return filteredEmails;
  } catch (error) {
    console.error("Error in filterCollabUserEmails:", error);
    return [];
  }
};

const handlePublicDomain = async (email, userId) => {
  const domain = email.split("@")[1];
  console.log("handlePublicDomain email:", email);
  console.log("handlePublicDomain domain:", domain);
  let workspaceName = email
    .split("@")[0]
    .replace(".", " ")
    .replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());

  let { data, error } = await supabase
    .from("workspaces")
    .select("workspace_id")
    .eq("meeting_attendee_email", email);

  if (error) {
    console.error("Error fetching workspace:", error);
    return null;
  }

  let workspaceId;
  if (data.length === 0) {
    // Workspace not found, create a new one
    workspaceId = uuidv4();

    let workspaceData = {
      workspace_id: workspaceId,
      meeting_attendee_email: email,
      workspace_name: workspaceName,
      collab_user_id: userId, // Use userId here
    };

    let { data: upsertData, error: workspaceUpsertError } = await supabase
      .from("workspaces")
      .upsert([workspaceData]);

    if (workspaceUpsertError) {
      console.error("Error upserting workspace:", workspaceUpsertError);
      return null;
    }
  } else {
    workspaceId = data[0].workspace_id;
  }

  return workspaceId;
};

const handlePrivateDomain = async (email, userId) => {
  const domain = email.split("@")[1];
  console.log("handlePrivateDomain email:", email);
  console.log("handlePrivateDomain domain:", domain);
  let workspaceName = domain.split(".")[0];
  workspaceName =
    workspaceName.charAt(0).toUpperCase() + workspaceName.slice(1); // Capitalize the first letter

  let { data, error } = await supabase
    .from("workspaces")
    .select("workspace_id")
    .eq("domain", domain);

  if (error) {
    console.error("Error fetching workspace:", error);
    return null;
  }

  let workspaceId;
  if (data.length === 0) {
    // Workspace not found, create a new one
    workspaceId = uuidv4();

    let workspaceData = {
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      domain: domain,
      collab_user_id: userId,
    };

    let { data: upsertData, error: workspaceUpsertError } = await supabase
      .from("workspaces")
      .upsert([workspaceData]);

    if (workspaceUpsertError) {
      console.error("Error upserting workspace:", workspaceUpsertError);
      return null;
    }
  } else {
    workspaceId = data[0].workspace_id;
  }

  return workspaceId;
};

// Check attendee
const checkAttendee = async (email, workspaceId) => {
  try {
    let { data: attendees, error } = await supabase
      .from("attendees")
      .select("attendee_id")
      .eq("attendee_email", email);

    if (error) {
      console.error("Error fetching attendee:", error);
      return null;
    }

    let attendeeId;

    if (attendees.length === 0) {
      // Attendee not found, create a new one
      attendeeId = uuidv4();

      let { data: upsertedAttendee, error: attendeeUpsertError } =
        await supabase.from("attendees").upsert([
          {
            attendee_id: attendeeId,
            attendee_email: email,
            workspace_id: workspaceId,
          },
        ]);

      if (attendeeUpsertError) {
        console.error("Error upserting attendee:", attendeeUpsertError);
        return null;
      }
    } else {
      // Use the first attendee if it exists
      attendeeId = attendees[0].attendee_id;
    }

    return attendeeId;
  } catch (error) {
    console.error("Error in checkAttendee:", error);
    return null;
  }
};

const analyzeMeetings = async (userId) => {
  try {
    let nextMeetings = [];

    // 1. Find the next meetings from time = now, from the calendar start_dateTime
    const futureMeetings = await fetchFutureMeetings();
    nextMeetings = nextMeetings.concat(futureMeetings);

    // If fewer than 8 meetings are fetched, find meetings from the past
    if (nextMeetings.length < 8) {
      const pastMeetings = await fetchPastMeetings(nextMeetings.length);
      nextMeetings = nextMeetings.concat(pastMeetings);
    }

    // For each meeting, create a list of creator_email, organizer_email, and attendee emails
    for (let meeting of nextMeetings) {
      const meetingDetails = await fetchMeetingDetails(meeting.id);
      if (!meetingDetails) continue;

      const attendees = await fetchMeetingAttendees(meeting.id);
      if (!attendees) continue;

      // Create an array of all emails for the current meeting
      let emails = [
        meetingDetails[0].creator_email,
        meetingDetails[0].organizer_email,
        ...attendees.map((attendee) => attendee.email),
      ];

      // Filter out emails that match with collab_user
      emails = await filterCollabUserEmails(emails);

      for (let email of emails) {
        let domain = email.split("@")[1];

        if (publicEmailDomains.includes(domain)) {
          const workspaceId = await handlePublicDomain(email, userId);
          if (!workspaceId) continue;

          const attendeeId = await checkAttendee(email, workspaceId);
          if (!attendeeId) continue;
        } else {
          const workspaceId = await handlePrivateDomain(email, userId);
          if (!workspaceId) continue;

          const attendeeId = await checkAttendee(email, workspaceId);
          if (!attendeeId) continue;
        }
      }
    }

    return nextMeetings;
  } catch (error) {
    console.error("Error analyzing meetings:", error);
  }
};

// Call the analyzeMeetings function after getting the Google Calendar data
const runApp = async (userId) => {
  await getGoogleCal(userId);
  await analyzeMeetings(userId);
};

// runApp();

module.exports = {
  loadClient,
  getGoogleCal,
};
