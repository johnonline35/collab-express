const supabase = require("../db/supabase");
const { updateAttendeesAndMeetings } = require("./attendeesAndMeetings"); // Update the import statement
const fetchPublicEmailDomains = require("../data/listOfEmailDomains");
const {
  getUserEmailAndDomain,
  filterAttendees,
} = require("./emailFilterService"); // Import the functions

async function analyzeMeetings(userId) {
  // console.log("Running analyzeMeetings for user id:", userId);
  // DEBUGGING ONLY BELOW:
  const meetingIdsToProcess = [
    "hjqhel66sboa3vut5ov89i7ki0",
    "vr83s27bjakob1hs1qiu30763o",
  ];
  // DEBUGGING END - REMOVE THE ABOVE ^^
  // Fetch the list of public email domains
  let publicEmailDomains = await fetchPublicEmailDomains();
  // console.log("Public email domains fetched:", publicEmailDomains);

  // Fetch the user's email and domain information once
  const userDetails = await getUserEmailAndDomain(userId);
  console.log("User email and domain fetched:", userDetails);

  // Retrieve the meetings and the attendees related to a specific user
  let { data: meetings } = await supabase
    .from("meetings")
    .select(
      `
    id,
    summary,
    creator_email,
    organizer_email,
    start_dateTime,
    end_dateTime,
    start_time_zone,
    end_time_zone,
    collab_user_id,
    meeting_attendees:meeting_attendees!meeting_id (
      meeting_id,
      email,
      organizer,
      response_status
    )
  `
    )
    .eq("collab_user_id", userId)
    .order("start_dateTime", { ascending: true });

  // console.log("User meetings fetched:", meetings);

  // Sort meetings by start_dateTime
  // meetings.sort(
  //   (a, b) => new Date(a.start_dateTime) - new Date(b.start_dateTime)
  // );
  // console.log("Meetings sorted by start dateTime:", meetings);

  // Prepare list of attendee emails and meeting attendees map for quick lookup
  const attendeeEmails = new Set();
  const meetingAttendeesMap = new Map();

  for (let meeting of meetings) {
    // DEBUGGING START - REMOVE THIS IF STATEMENT AFTERWARDS
    if (!meetingIdsToProcess.includes(meeting.id)) {
      continue;
    }
    // END OF DEBUGGING - REMOVE THE ABOVE ^^
    let attendees = []; // Initialize the attendees array for each meeting

    const creatorExists = meeting.meeting_attendees.some(
      (attendee) => attendee.email === meeting.creator_email
    );

    // Add creator and organizer to the attendees list
    if (!creatorExists) {
      meeting.meeting_attendees.push({
        meeting_id: meeting.id,
        email: meeting.creator_email,
        organizer: false,
        response_status: "creator",
      });
    }

    // Populate 'attendees' with the list of meeting attendees ok
    attendees.push(...meeting.meeting_attendees);

    // for (let meeting of meetings) {
    //   // console.log(`Meeting object: ${JSON.stringify(meeting)}`);
    //   // console.log(
    //   //   `Meeting attendees: ${JSON.stringify(meeting.meeting_attendees)}`
    //   // );

    //   // Add creator and organizer to the attendees list
    //   let attendees = [
    //     ...meeting.meeting_attendees,
    //     {
    //       meeting_id: meeting.id,
    //       email: meeting.creator_email,
    //       organizer: false,
    //       response_status: "creator",
    //     },
    //   ];

    // console.log("Attendees for meeting ID", meeting.id, ":", attendees);

    // Filter attendees based on their email domains
    const filteredAttendees = filterAttendees(
      attendees,
      publicEmailDomains,
      userDetails
    );
    // console.log(
    //   "Filtered attendees for meeting:",
    //   meeting.id,
    //   filteredAttendees
    // );
    meeting.meeting_attendees = filteredAttendees;

    // Add attendees' emails to the set for batch querying
    for (let attendee of filteredAttendees) {
      attendeeEmails.add(attendee.email);
    }

    // Map meeting ID to its attendees for later use
    meetingAttendeesMap.set(meeting.id, filteredAttendees);
  }
  // console.log(
  //   "Filtered attendees:",
  //   attendeeEmails.size,
  //   "Emails:",
  //   Array.from(attendeeEmails)
  // );

  // Fetch all existing collab attendees, so that the new meetings and meeting attendees can be filtered against them. A new collab attendee from a meeting is only created if it does not exist in this list:
  let existingAttendees = [];
  const chunkSize = 200; // Adjust as necessary
  const attendeeEmailsArray = Array.from(attendeeEmails);
  for (let i = 0; i < attendeeEmailsArray.length; i += chunkSize) {
    const chunk = attendeeEmailsArray.slice(i, i + chunkSize);
    const result = await supabase
      .from("attendees")
      .select("*")
      .eq("collab_user_id", userId)
      .in("attendee_email", chunk);

    if (result.data) {
      existingAttendees = existingAttendees.concat(result.data);
    } else {
      console.error("Error retrieving existing attendees:", result.error);
    }
  }

  // console.log(
  //   "existingAttendees array in order before next function:",
  //   existingAttendees
  // );

  // Fetch all matching attendees in a single query
  // let existingAttendees = [];
  // if (attendeeEmails.size > 0) {
  //   const result = await supabase
  //     .from("attendees")
  //     .select("*")
  //     .in("attendee_email", Array.from(attendeeEmails));

  //   if (result.data) {
  //     existingAttendees = result.data;
  //   } else {
  //     console.error("Error retrieving existing attendees:", result.error);
  //   }
  // }

  // Update attendees and meetings in batch
  await updateAttendeesAndMeetings(
    existingAttendees,
    meetings,
    meetingAttendeesMap,
    userId,
    userDetails,
    publicEmailDomains
  );
  console.log("Attendees and meetings updated.");

  return meetings;
}

// async function analyzeMeetings(userId) {
//   // console.log("Running analyzeMeetings for user id:", userId);

//   // Fetch the list of public email domains
//   let publicEmailDomains = await fetchPublicEmailDomains();
//   // console.log("Public email domains fetched:", publicEmailDomains);

//   // Fetch the user's email and domain information once
//   const userDetails = await getUserEmailAndDomain(userId);
//   console.log("User email and domain fetched:", userDetails);

//   // Retrieve the meetings and the attendees related to a specific user
//   let { data: meetings } = await supabase
//     .from("meetings")
//     .select(
//       `
//     id,
//     summary,
//     creator_email,
//     organizer_email,
//     start_dateTime,
//     end_dateTime,
//     start_time_zone,
//     end_time_zone,
//     collab_user_id,
//     meeting_attendees:meeting_attendees!meeting_id (
//       meeting_id,
//       email,
//       organizer,
//       response_status
//     )
//   `
//     )
//     .eq("collab_user_id", userId)
//     .order("start_dateTime", { ascending: true });

//   // console.log("User meetings fetched:", meetings);

//   // Sort meetings by start_dateTime
//   // meetings.sort(
//   //   (a, b) => new Date(a.start_dateTime) - new Date(b.start_dateTime)
//   // );
//   // console.log("Meetings sorted by start dateTime:", meetings);

//   // Prepare list of attendee emails and meeting attendees map for quick lookup
//   const attendeeEmails = new Set();
//   const meetingAttendeesMap = new Map();

//   for (let meeting of meetings) {
//     let attendees = []; // Initialize the attendees array for each meeting

//     const creatorExists = meeting.meeting_attendees.some(
//       (attendee) => attendee.email === meeting.creator_email
//     );

//     // Add creator and organizer to the attendees list
//     if (!creatorExists) {
//       meeting.meeting_attendees.push({
//         meeting_id: meeting.id,
//         email: meeting.creator_email,
//         organizer: false,
//         response_status: "creator",
//       });
//     }

//     // Populate 'attendees' with the list of meeting attendees ok
//     attendees.push(...meeting.meeting_attendees);

//     // for (let meeting of meetings) {
//     //   // console.log(`Meeting object: ${JSON.stringify(meeting)}`);
//     //   // console.log(
//     //   //   `Meeting attendees: ${JSON.stringify(meeting.meeting_attendees)}`
//     //   // );

//     //   // Add creator and organizer to the attendees list
//     //   let attendees = [
//     //     ...meeting.meeting_attendees,
//     //     {
//     //       meeting_id: meeting.id,
//     //       email: meeting.creator_email,
//     //       organizer: false,
//     //       response_status: "creator",
//     //     },
//     //   ];

//     // console.log("Attendees for meeting ID", meeting.id, ":", attendees);

//     // Filter attendees based on their email domains
//     const filteredAttendees = filterAttendees(
//       attendees,
//       publicEmailDomains,
//       userDetails
//     );
//     // console.log(
//     //   "Filtered attendees for meeting:",
//     //   meeting.id,
//     //   filteredAttendees
//     // );
//     meeting.meeting_attendees = filteredAttendees;

//     // Add attendees' emails to the set for batch querying
//     for (let attendee of filteredAttendees) {
//       attendeeEmails.add(attendee.email);
//     }

//     // Map meeting ID to its attendees for later use
//     meetingAttendeesMap.set(meeting.id, filteredAttendees);
//   }
//   // console.log(
//   //   "Filtered attendees:",
//   //   attendeeEmails.size,
//   //   "Emails:",
//   //   Array.from(attendeeEmails)
//   // );

//   // Fetch all existing collab attendees, so that the new meetings and meeting attendees can be filtered against them. A new collab attendee from a meeting is only created if it does not exist in this list:
//   let existingAttendees = [];
//   const chunkSize = 200; // Adjust as necessary
//   const attendeeEmailsArray = Array.from(attendeeEmails);
//   for (let i = 0; i < attendeeEmailsArray.length; i += chunkSize) {
//     const chunk = attendeeEmailsArray.slice(i, i + chunkSize);
//     const result = await supabase
//       .from("attendees")
//       .select("*")
//       .eq("collab_user_id", userId)
//       .in("attendee_email", chunk);

//     if (result.data) {
//       existingAttendees = existingAttendees.concat(result.data);
//     } else {
//       console.error("Error retrieving existing attendees:", result.error);
//     }
//   }

//   // console.log(
//   //   "existingAttendees array in order before next function:",
//   //   existingAttendees
//   // );

//   // Fetch all matching attendees in a single query
//   // let existingAttendees = [];
//   // if (attendeeEmails.size > 0) {
//   //   const result = await supabase
//   //     .from("attendees")
//   //     .select("*")
//   //     .in("attendee_email", Array.from(attendeeEmails));

//   //   if (result.data) {
//   //     existingAttendees = result.data;
//   //   } else {
//   //     console.error("Error retrieving existing attendees:", result.error);
//   //   }
//   // }

//   // Update attendees and meetings in batch
//   await updateAttendeesAndMeetings(
//     existingAttendees,
//     meetings,
//     meetingAttendeesMap,
//     userId,
//     userDetails,
//     publicEmailDomains
//   );
//   console.log("Attendees and meetings updated.");

//   return meetings;
// }

module.exports = {
  analyzeMeetings,
};
