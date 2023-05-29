// WORKING LAST LONG VERSION BEFORE BREAKING UP INTO FUNCTIONS MAY 15

// ANALYZE THE MEETINGS FETCHED FROM GOOGLE CALENDAR
// const analyzeMeetings = async () => {
//   try {
//     let nextMeetings = [];

//     // 1. Find the next meetings from time = now, from the calendar start_dateTime
//     let { data: futureMeetings, error } = await supabase
//       .from("meetings")
//       .select("id")
//       .gte("start_dateTime", new Date().toISOString())
//       .order("start_dateTime", { ascending: true })
//       .limit(8);

//     if (error) {
//       console.error("Error fetching future meetings:", error);
//       return;
//     }

//     nextMeetings = nextMeetings.concat(futureMeetings);

//     // If fewer than 8 meetings are fetched, find meetings from the past
//     if (nextMeetings.length < 8) {
//       let { data: pastMeetings, error: pastError } = await supabase
//         .from("meetings")
//         .select("id")
//         .lt("start_dateTime", new Date().toISOString())
//         .order("start_dateTime", { ascending: false }) // Ordering by descending to get most recent past meetings
//         .limit(8 - nextMeetings.length); // Fetch the remaining number of meetings to reach 8

//       if (pastError) {
//         console.error("Error fetching past meetings:", pastError);
//         return;
//       }

//       // Add past meetings after the future meetings
//       nextMeetings = nextMeetings.concat(pastMeetings);
//     }

//     // For each meeting, create a list of creator_email, organizer_email, and attendee emails
//     for (let meeting of nextMeetings) {
//       let { data: meetingDetails, error } = await supabase
//         .from("meetings")
//         .select("creator_email, organizer_email")
//         .eq("id", meeting.id);

//       if (error) {
//         console.error(
//           `Error fetching meeting details for meeting id: ${meeting.id}:`,
//           error
//         );
//         continue;
//       }

//       let { data: attendees, error: attendeesError } = await supabase
//         .from("meeting_attendees")
//         .select("email")
//         .eq("meeting_id", meeting.id);

//       if (attendeesError) {
//         console.error(
//           `Error fetching attendees for meeting id: ${meeting.id}:`,
//           attendeesError
//         );
//         continue;
//       }

//       // Create an array of all emails for the current meeting
//       let emails = [
//         meetingDetails[0].creator_email,
//         meetingDetails[0].organizer_email,
//         ...attendees.map((attendee) => attendee.email),
//       ];

//       // Filter out emails that match with collab_users
//       emails = await Promise.all(
//         emails.map(async (email) => {
//           let { data: collabUsers, error: collabUsersError } = await supabase
//             .from("collab_users")
//             .select("collab_user_email")
//             .eq("collab_user_email", email);

//           if (collabUsersError) {
//             console.error("Error checking collab_users:", collabUsersError);
//             return email; // In case of error, include the email
//           }

//           // If the email doesn't match with any collab_user_email, include it
//           if (collabUsers.length === 0) {
//             return email;
//           }

//           // If the email matches with a collab_user_email, exclude it
//           return null;
//         })
//       );

//       // Remove any null values (which correspond to matching collab_user_emails)
//       emails = emails.filter((email) => email !== null);

//       for (let email of emails) {
//         let domain = email.split("@")[1];

//         if (publicEmailDomains.includes(domain)) {
//           // Check workspace
//           let { data: workspaces, error: workspaceError } = await supabase
//             .from("workspaces")
//             .select("workspace_id")
//             .eq("meeting_attendee_email", email);

//           if (workspaceError) {
//             console.error("Error fetching workspace:", workspaceError);
//             continue;
//           }

//           let workspaceId;

//           if (workspaces.length === 0) {
//             // Workspace not found, create a new one
//             workspaceId = uuidv4();
//             let workspaceName = email
//               .split("@")[0]
//               .replace(".", " ")
//               .replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());

//             let { error: workspaceUpsertError } = await supabase
//               .from("workspaces")
//               .upsert([
//                 {
//                   workspace_id: workspaceId,
//                   meeting_attendee_email: email,
//                   workspace_name: workspaceName,
//                   collab_user_id: "e9e5c103-22e9-4616-bf9c-c10813293942",
//                 },
//               ]);

//             if (workspaceUpsertError) {
//               console.error("Error upserting workspace:", workspaceUpsertError);
//               continue;
//             }
//           } else {
//             workspaceId = workspaces[0].workspace_id;
//           }

//           // Check attendee
//           let { data: attendees, error: attendeeError } = await supabase
//             .from("attendees")
//             .select("attendee_id")
//             .eq("attendee_email", email);

//           if (attendeeError) {
//             console.error("Error fetching attendee:", attendeeError);
//             continue;
//           }

//           let attendeeId;

//           if (attendees.length === 0) {
//             // Attendee not found, create a new one
//             attendeeId = uuidv4();

//             let { error: attendeeUpsertError } = await supabase
//               .from("attendees")
//               .upsert([
//                 {
//                   attendee_id: attendeeId,
//                   attendee_email: email,
//                   workspace_id: workspaceId,
//                 },
//               ]);

//             if (attendeeUpsertError) {
//               console.error("Error upserting attendee:", attendeeUpsertError);
//               continue;
//             }
//           } else {
//             // Use the first attendee if it exists
//             attendeeId = attendees[0].attendee_id;
//           }
//         }
//       }
//     }

//     return nextMeetings;
//   } catch (error) {
//     console.error("Error analyzing meetings:", error);
//   }
// };

// WORKING VERSION SATURDAY MAY 13 - RETURNS AN ARRAY of 8 MEETINGS TOTALLY OPTIMIZED

// require("dotenv").config();
// const { v4: uuidv4 } = require("uuid");
// const { createClient } = require("@supabase/supabase-js");
// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// const { google } = require("googleapis");
// const token = process.env.REFRESH_TOKEN;
// const client_id = process.env.CLIENT_ID;
// const client_secret = process.env.CLIENT_SECRET;
// const redirect_url = "localhost:3000";

// const Bottleneck = require("bottleneck");
// const limiter = new Bottleneck({
//   minTime: 100, // Adjust this value based on your rate limits
// });

// const supabase = createClient(supabaseUrl, supabaseAnonKey);

// const oauth2Client = new google.auth.OAuth2(
//   client_id,
//   client_secret,
//   redirect_url
// );

// const loadClient = () => {
//   oauth2Client.setCredentials({ refresh_token: token });
//   return google.calendar({ version: "v3", auth: oauth2Client });
// };

// const getGoogleCal = async () => {
//   const calendar = loadClient();

//   const now = new Date();
//   const sixtyMonthsAgo = new Date(now.getTime());
//   sixtyMonthsAgo.setMonth(now.getMonth() - 1);
//   const timeMin = sixtyMonthsAgo.toISOString();

//   const twoMonthsFromNow = new Date(now.getTime());
//   twoMonthsFromNow.setMonth(now.getMonth() + 2);
//   const timeMax = twoMonthsFromNow.toISOString();

//   let allEvents = [];
//   let nextPageToken = undefined;

//   try {
//     do {
//       const response = await calendar.events.list({
//         calendarId: "primary",
//         timeMin: timeMin,
//         timeMax: timeMax,
//         singleEvents: true,
//         orderBy: "startTime",
//         pageToken: nextPageToken,
//       });

//       allEvents = allEvents.concat(response.data.items);
//       nextPageToken = response.data.nextPageToken;
//     } while (nextPageToken);

//     const meetings = allEvents.filter(
//       (event) =>
//         event.attendees &&
//         event.attendees.length > 1 &&
//         event.attendees.length < 11
//     );

//     // Insert data into the database for each meeting
//     const upsertPromises = meetings.map(async (meeting) => {
//       const attendees = meeting.attendees.filter(
//         (attendee) => attendee.email !== "johnchildseddy@gmail.com"
//       );

//       const meetingData = {
//         id: meeting.id,
//         summary: meeting.summary,
//         creator_email: meeting.creator.email,
//         organizer_email: meeting.organizer.email,
//         start_dateTime: meeting.start.dateTime,
//         end_dateTime: meeting.end.dateTime,
//       };

//       try {
//         console.log("Upserting meeting data:", meetingData);
//         // Wait for the meeting upsert to complete before upserting attendees
//         const { data: upsertMeetingData, error: upsertMeetingError } =
//           await limiter.schedule(() =>
//             supabase
//               .from("meetings")
//               .upsert([meetingData], { returning: "minimal" })
//           );

//         if (upsertMeetingError) {
//           console.error("Upsert Meeting Error:", upsertMeetingError);
//           return;
//         }

//         console.log("Upsert Meeting Data:", upsertMeetingData);

//         // Now that the meeting has been upserted, upsert attendees
//         await Promise.all(
//           attendees.map(async (attendee) => {
//             const { data: upsertAttendeeData, error: upsertAttendeeError } =
//               await limiter.schedule(() =>
//                 supabase.from("meeting_attendees").upsert(
//                   [
//                     {
//                       meeting_id: meeting.id,
//                       email: attendee.email,
//                       organizer: attendee.organizer || false,
//                       response_status: attendee.responseStatus,
//                     },
//                   ],
//                   { returning: "minimal" }
//                 )
//               );

//             if (upsertAttendeeError) {
//               console.error("Upsert Attendee Error:", upsertAttendeeError);
//             } else {
//               console.log("Upsert Attendee Data:", upsertAttendeeData);
//             }
//           })
//         );
//       } catch (error) {
//         console.error("Upsert process error:", error);
//       }
//     });

//     await Promise.all(upsertPromises);

//     // Log filtered meetings
//     // console.log(JSON.stringify(meetings, null, 2));

//     return meetings;
//   } catch (error) {
//     console.error("The API returned an error:", error);
//     return [];
//   }
// };

// const analyzeMeetings = async () => {
//   try {
//     let nextMeetings = [];

//     // 1. Find the next meetings from time = now, from the calendar start_dateTime
//     let { data: futureMeetings, error } = await supabase
//       .from("meetings")
//       .select("id")
//       .gte("start_dateTime", new Date().toISOString())
//       .order("start_dateTime", { ascending: true })
//       .limit(8);

//     if (error) {
//       console.error("Error fetching future meetings:", error);
//       return;
//     }

//     nextMeetings = nextMeetings.concat(futureMeetings);

//     // If fewer than 8 meetings are fetched, find meetings from the past
//     if (nextMeetings.length < 8) {
//       let { data: pastMeetings, error: pastError } = await supabase
//         .from("meetings")
//         .select("id")
//         .lt("start_dateTime", new Date().toISOString())
//         .order("start_dateTime", { ascending: false }) // Ordering by descending to get most recent past meetings
//         .limit(8 - nextMeetings.length); // Fetch the remaining number of meetings to reach 8

//       if (pastError) {
//         console.error("Error fetching past meetings:", pastError);
//         return;
//       }

//       // Add past meetings after the future meetings
//       nextMeetings = nextMeetings.concat(pastMeetings);
//     }

//     // For each meeting, create a list of creator_email, organizer_email, and attendee emails
//     for (let meeting of nextMeetings) {
//       let { data: meetingDetails, error } = await supabase
//         .from("meetings")
//         .select("creator_email, organizer_email")
//         .eq("id", meeting.id);

//       if (error) {
//         console.error(
//           `Error fetching meeting details for meeting id: ${meeting.id}:`,
//           error
//         );
//         continue;
//       }

//       let { data: attendees, error: attendeesError } = await supabase
//         .from("meeting_attendees")
//         .select("email")
//         .eq("meeting_id", meeting.id);

//       if (attendeesError) {
//         console.error(
//           `Error fetching attendees for meeting id: ${meeting.id}:`,
//           attendeesError
//         );
//         continue;
//       }

//       // Create an array of all emails for the current meeting
//       let emails = [
//         meetingDetails[0].creator_email,
//         meetingDetails[0].organizer_email,
//         ...attendees.map((attendee) => attendee.email),
//       ];

//       // Filter out emails that match with collab_users
//       emails = await Promise.all(
//         emails.map(async (email) => {
//           let { data: collabUsers, error: collabUsersError } = await supabase
//             .from("collab_users")
//             .select("collab_user_email")
//             .eq("collab_user_email", email);

//           if (collabUsersError) {
//             console.error("Error checking collab_users:", collabUsersError);
//             return email; // In case of error, include the email
//           }

//           // If the email doesn't match with any collab_user_email, include it
//           if (collabUsers.length === 0) {
//             return email;
//           }
//           // Otherwise, return null (we'll filter these out)
//           return null;
//         })
//       );

//       // Remove nulls from the array (these were matching emails)
//       emails = emails.filter((email) => email !== null);

//       // Remove duplicates from emails array
//       emails = [...new Set(emails)];

//       console.log(`Emails for meeting id ${meeting.id}:`, emails);
//     }
//   } catch (error) {
//     console.error("Error during analyzeMeetings process:", error);
//   }
// };

// // Call the analyzeMeetings function after getting the Google Calendar data
// const runApp = async () => {
//   await getGoogleCal();
//   await analyzeMeetings();
// };

// runApp();

// module.exports = {
//   loadClient,
//   getGoogleCal,
// };

// FIRST VERSION OF GOOGLE FETCH CODE THAT CREATES A WORKSPACE

// require("dotenv").config();
// const { createClient } = require("@supabase/supabase-js");
// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// const { google } = require("googleapis");
// const token = process.env.REFRESH_TOKEN;
// const client_id = process.env.CLIENT_ID;
// const client_secret = process.env.CLIENT_SECRET;
// const redirect_url = "localhost:3000";

// const supabase = createClient(supabaseUrl, supabaseAnonKey);

// const oauth2Client = new google.auth.OAuth2(
//   client_id,
//   client_secret,
//   redirect_url
// );

// const loadClient = () => {
//   oauth2Client.setCredentials({ refresh_token: token });
//   return google.calendar({ version: "v3", auth: oauth2Client });
// };

// const getGoogleCal = async () => {
//   const calendar = loadClient();

//   const now = new Date();
//   const twelveMonthsAgo = new Date(now.getTime());
//   twelveMonthsAgo.setMonth(now.getMonth() - 12);
//   const timeMin = twelveMonthsAgo.toISOString();

//   try {
//     const response = await calendar.events.list({
//       calendarId: "primary",
//       timeMin: twelveMonthsAgo.toISOString(),
//       timeMax: now.toISOString(),
//       singleEvents: true,
//       orderBy: "startTime",
//     });

//     const allEvents = response.data.items;

//     const meetings = allEvents.filter(
//       (event) =>
//         event.attendees &&
//         event.attendees.length > 1 &&
//         event.attendees.length < 11
//     );

//     const filteredMeetings = meetings.map((meeting) => {
//       const attendees = meeting.attendees.filter(
//         (attendee) => attendee.email !== "johnchildseddy@gmail.com"
//       );

//       return {
//         id: meeting.id,
//         // status: meeting.status,
//         // htmlLink: meeting.htmlLink,
//         // created: meeting.created,
//         // updated: meeting.updated,
//         summary: meeting.summary,
//         creator: meeting.creator,
//         organizer: meeting.organizer,
//         start: meeting.start,
//         end: meeting.end,
//         attendees: attendees,
//         reminders: meeting.reminders,
//       };
//     });

//     console.log(JSON.stringify(filteredMeetings, null, 2));
//     return filteredMeetings;
//   } catch (error) {
//     console.error("The API returned an error:", error);
//     return [];
//   }
// };

// module.exports = {
//   loadClient,
//   getGoogleCal,
// };

// const { google } = require("googleapis");

// const token = process.env.REFRESH_TOKEN;
// const client_id = process.env.CLIENT_ID;
// const client_secret = process.env.CLIENT_SECRET;
// const redirect_url = "localhost:3000";

// const oauth2Client = new google.auth.OAuth2(
//   client_id,
//   client_secret,
//   redirect_url
// );

// const loadClient = () => {
//   oauth2Client.setCredentials({ refresh_token: token });
//   return google.calendar({ version: "v3", auth: oauth2Client });
// };

// const capitalizeFirstLetter = (string) => {
//   return string.charAt(0).toUpperCase() + string.slice(1);
// };

// const getGoogleCal = async () => {
//   const calendar = loadClient();

//   const now = new Date();
//   const twelveMonthsAgo = new Date(now.getTime());
//   twelveMonthsAgo.setMonth(now.getMonth() - 60);

//   let nextPageToken;
//   let allEvents = [];

//   try {
//     do {
//       const response = await calendar.events.list({
//         calendarId: "primary",
//         timeMin: twelveMonthsAgo.toISOString(),
//         timeMax: now.toISOString(),
//         showDeleted: false,
//         singleEvents: true,
//         orderBy: "startTime",
//         pageToken: nextPageToken,
//       });

//       allEvents.push(...response.data.items);
//       nextPageToken = response.data.nextPageToken;
//     } while (nextPageToken);

//     const meetings = allEvents.filter(
//       (event) =>
//         event.attendees &&
//         event.attendees.length > 0 &&
//         event.attendees.length < 11
//     );

//     const reducedMeetings = meetings.map((meeting) => {
//       const { attendees, start, end } = meeting;
//       const startDate = start.dateTime
//         ? new Date(start.dateTime).toISOString().slice(0, 10) // Extract the date part of startDateTime
//         : new Date().toISOString().slice(0, 10); // Use the current date if start.dateTime is not available
//       return {
//         attendees: attendees.map((attendee) => ({
//           email: attendee.email,
//           displayName: attendee.displayName ?? null,
//           organizer: attendee.organizer ?? false,
//           responseStatus: attendee.responseStatus,
//         })),
//         startDateTime: startDate, // Use the extracted date
//         endDateTime: end.dateTime,
//       };
//     });

//     const domainSummary = {};

//     for (let meeting of reducedMeetings) {
//       for (let attendee of meeting.attendees) {
//         if (attendee.email !== "johnchildseddy@gmail.com") {
//           const attendeeDomain = attendee.email.split("@")[1];

//           if (!domainSummary[attendeeDomain]) {
//             const workspaceName = capitalizeFirstLetter(
//               attendeeDomain.split(".")[0]
//             );

//             domainSummary[attendeeDomain] = {
//               workspaceName,
//               firstMeeting: meeting.startDateTime,
//               uniqueAttendees: [],
//               meetingCount: 0,
//               meetingList: {}, // Changed meetingList to an object
//               uniqueMeetings: new Set(),
//             };
//           }

//           if (
//             !domainSummary[attendeeDomain].uniqueAttendees.some(
//               (uniqueAttendee) => uniqueAttendee.email === attendee.email
//             )
//           ) {
//             domainSummary[attendeeDomain].uniqueAttendees.push({
//               email: attendee.email,
//               displayName: attendee.displayName,
//             });
//           }

//           if (meeting.startDateTime) {
//             domainSummary[attendeeDomain].uniqueMeetings.add(
//               meeting.startDateTime
//             );
//             domainSummary[attendeeDomain].meetingCount =
//               domainSummary[attendeeDomain].uniqueMeetings.size;

//             // Add the startDateTime to the meetingList object with incrementing meetingDate keys
//             const meetingDateKey = `meetingDate${domainSummary[attendeeDomain].meetingCount}`;
//             domainSummary[attendeeDomain].meetingList[meetingDateKey] =
//               meeting.startDateTime;
//           }
//         }
//       }
//     }

//     const output = Object.entries(domainSummary).map(([domain, data]) => {
//       delete data.uniqueMeetings; // Remove the uniqueMeetings Set from the output data
//       return {
//         domain,
//         workspaceName: data.workspaceName,
//         firstMeeting: data.firstMeeting,
//         uniqueAttendees: data.uniqueAttendees,
//         meetingCount: data.meetingCount,
//         meetingList: data.meetingList,
//       };
//     });

//     console.log("Domain Summary:", JSON.stringify(output, null, 2));

//     return output;
//   } catch (error) {
//     console.error("The API returned an error:", error);
//     return []; // Return an empty array if there's an error
//   }
// };

// module.exports = {
//   loadClient,
//   getGoogleCal,
// };
