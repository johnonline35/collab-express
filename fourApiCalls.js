// const { google } = require('googleapis');
// const axios = require('axios');
// const { createClient } = require('@supabase/supabase-js');

// // Your Supabase credentials
// const supabaseUrl = 'your-supabase-url';
// const supabaseKey = 'your-supabase-key';
// const supabase = createClient(supabaseUrl, supabaseKey);

// // Your API keys
// const avatarApiKey = 'your-avatarapi-key';
// const brandfetchApiKey = 'your-brandfetch-key';
// const linkedInApiKey = 'your-linkedin-api-key';

// // Google Calendar API setup
// const calendar = google.calendar({ version: 'v3', auth: 'your-google-api-key' });

// async function main() {
//   // Fetch meetings and attendees' email addresses
//   const meetings = await getMeetings();
//   const emails = getEmailsFromMeetings(meetings);

//   // Fetch data from AvatarAPI, Brandfetch, and LinkedIn Company Data API
//   const avatarData = await fetchDataFromAvatarAPI(emails);
//   const brandfetchData = await fetchDataFromBrandfetchAPI(emails);
//   const linkedInData = await fetchDataFromLinkedInAPI(emails);

//   // Update Supabase tables
//   await updateSupabase(avatarData, 'avatar_table');
//   await updateSupabase(brandfetchData, 'brandfetch_table');
//   await updateSupabase(linkedInData, 'linkedin_table');
// }

// async function getMeetings() {
//   // Fetch a list of meetings using the Google Calendar API
//   // Customize the query parameters as needed
//   const response = await calendar.events.list({
//     calendarId: 'primary',
//     timeMin: (new Date()).toISOString(),
//     maxResults: 10,
//     singleEvents: true,
//     orderBy: 'startTime',
//   });

//   return response.data.items;
// }

// function getEmailsFromMeetings(meetings) {
//   // Extract email addresses of attendees from the list of meetings
//   const emails = new Set();

//   meetings.forEach(meeting => {
//     if (meeting.attendees) {
//       meeting.attendees.forEach(attendee => {
//         if (attendee.email) {
//           emails.add(attendee.email);
//         }
//       });
//     }
//   });

//   return Array.from(emails);
// }

// async function fetchDataFromAvatarAPI(emails) {
//   // Fetch data from AvatarAPI using email addresses
//   const promises = emails.map(email => axios.get(`https://www.avatarapi.com/avatar.asmx/GetProfile?email=${email}&key=${avatarApiKey}`));
//   const responses = await Promise.all(promises);
//   return responses.map(response => response.data);
// }

// async function fetchDataFromBrandfetchAPI(emails) {
//   // Fetch data from Brandfetch API using email addresses
//   const promises = emails.map((email) =>
//     axios.get(`https://api.brandfetch.io/v1/email/${email}`, {
//       headers: { "X-Api-Key": brandfetchApiKey },
//     })
//   );
//   const responses = await Promise.all(promises);
//   return responses.map((response) => response.data);
// }

// async function fetchDataFromLinkedInAPI(emails) {
//   // Fetch data from LinkedIn Company Data API using email addresses
//   const promises = emails.map((email) =>
//     axios.get(
//       `https://linkedin-company-data.p.rapidapi.com/companies?email=${email}`,
//       {
//         headers: {
//           "X-RapidAPI-Host": "linkedin-company-data.p.rapidapi.com",
//           "X-RapidAPI-Key": linkedInApiKey,
//         },
//       }
//     )
//   );
//   const responses = await Promise.all(promises);
//   return responses.map((response) => response.data);
// }

// async function updateSupabase(data, tableName) {
//   // Update the specified Supabase table with the fetched data
//   for (const item of data) {
//     const { data: result, error } = await supabase
//       .from(tableName)
//       .insert([item]);
//     if (error) {
//       console.error(`Error updating ${tableName}:`, error);
//     }
//   }
// }

// // Run the main function
// main().catch(console.error);
