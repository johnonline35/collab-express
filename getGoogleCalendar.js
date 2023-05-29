require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const { google } = require("googleapis");
const token = process.env.REFRESH_TOKEN;
const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const redirect_url = "localhost:3000";

const Bottleneck = require("bottleneck");
const limiter = new Bottleneck({
  minTime: 100, // Adjust this value based on your rate limits
});

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_url
);

const loadClient = () => {
  oauth2Client.setCredentials({ refresh_token: token });
  return google.calendar({ version: "v3", auth: oauth2Client });
};

// FETCH MEETINGS FROM GOOGLE CALENDAR
const getGoogleCal = async () => {
  const calendar = loadClient();

  const now = new Date();
  const sixtyMonthsAgo = new Date(now.getTime());
  sixtyMonthsAgo.setMonth(now.getMonth() - 1);
  const timeMin = sixtyMonthsAgo.toISOString();

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
        (attendee) => attendee.email !== "johnchildseddy@gmail.com"
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

module.exports = getGoogleCal;
