const { publicEmailDomains } = require("../data/listOfEmailDomains");
const { checkAttendee } = require("../models/attendees");
const { assignWorkspaceLead } = require("../services/workspaceService"); // Import the new function
const {
  handlePublicDomain,
  handlePrivateDomain,
} = require("../handlers/workspaceHandler");
const {
  fetchFutureMeetings,
  fetchPastMeetings,
  fetchMeetingDetails,
  fetchMeetingAttendees,
} = require("../models/meetingsModel");
const { filterCollabUserEmails } = require("./emailFilterService");

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

        let workspaceId;
        if (publicEmailDomains.includes(domain)) {
          workspaceId = await handlePublicDomain(email, userId);
        } else {
          workspaceId = await handlePrivateDomain(email, userId);
        }

        if (!workspaceId) continue;

        const attendeeId = await checkAttendee(email, workspaceId);
        if (!attendeeId) continue;

        // Call the assignWorkspaceLead function here
        await assignWorkspaceLead(email, workspaceId);
      }
    }

    return nextMeetings;
  } catch (error) {
    console.error("Error analyzing meetings:", error);
  }
};

module.exports = {
  analyzeMeetings,
};

// const { publicEmailDomains } = require("../data/listOfEmailDomains");
// const { checkAttendee } = require("../models/attendees");
// const {
//   handlePublicDomain,
//   handlePrivateDomain,
// } = require("../handlers/workspaceHandler");
// const {
//   fetchFutureMeetings,
//   fetchPastMeetings,
//   fetchMeetingDetails,
//   fetchMeetingAttendees,
// } = require("../models/meetingsModel");
// const { filterCollabUserEmails } = require("./emailFilterService");

// const analyzeMeetings = async (userId) => {
//   try {
//     let nextMeetings = [];

//     // 1. Find the next meetings from time = now, from the calendar start_dateTime
//     const futureMeetings = await fetchFutureMeetings();
//     nextMeetings = nextMeetings.concat(futureMeetings);

//     // If fewer than 8 meetings are fetched, find meetings from the past
//     if (nextMeetings.length < 8) {
//       const pastMeetings = await fetchPastMeetings(nextMeetings.length);
//       nextMeetings = nextMeetings.concat(pastMeetings);
//     }

//     // For each meeting, create a list of creator_email, organizer_email, and attendee emails
//     for (let meeting of nextMeetings) {
//       const meetingDetails = await fetchMeetingDetails(meeting.id);
//       if (!meetingDetails) continue;

//       const attendees = await fetchMeetingAttendees(meeting.id);
//       if (!attendees) continue;

//       // Create an array of all emails for the current meeting
//       let emails = [
//         meetingDetails[0].creator_email,
//         meetingDetails[0].organizer_email,
//         ...attendees.map((attendee) => attendee.email),
//       ];

//       // Filter out emails that match with collab_user
//       emails = await filterCollabUserEmails(emails);

//       for (let email of emails) {
//         let domain = email.split("@")[1];

//         if (publicEmailDomains.includes(domain)) {
//           const workspaceId = await handlePublicDomain(email, userId);
//           if (!workspaceId) continue;

//           const attendeeId = await checkAttendee(email, workspaceId);
//           if (!attendeeId) continue;
//         } else {
//           const workspaceId = await handlePrivateDomain(email, userId);
//           if (!workspaceId) continue;

//           const attendeeId = await checkAttendee(email, workspaceId);
//           if (!attendeeId) continue;
//         }
//       }
//     }

//     return nextMeetings;
//   } catch (error) {
//     console.error("Error analyzing meetings:", error);
//   }
// };

// module.exports = {
//   analyzeMeetings,
// };
