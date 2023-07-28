const supabase = require("../db/supabase");
const { updateAttendeesAndMeetings } = require("./attendeesAndMeetings"); // Update the import statement
const fetchPublicEmailDomains = require("../data/listOfEmailDomains");
const {
  getUserEmailAndDomain,
  filterAttendees,
} = require("./emailFilterService"); // Import the functions

async function analyzeMeetings(userId) {
  // console.log("Running analyzeMeetings for user id:", userId);

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
  const attendees = [];

  for (let meeting of meetings) {
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

    // Populate 'attendees' with the list of meeting attendees
    attendees.push(...meeting.meeting_attendees);

    // let attendees = [
    //   ...meeting.meeting_attendees,
    //   {
    //     meeting_id: meeting.id,
    //     email: meeting.creator_email,
    //     organizer: false,
    //     response_status: "creator",
    //   },
    // ];

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

module.exports = {
  analyzeMeetings,
};

// const { checkAttendee } = require("../models/attendees");
// // const { assignWorkspaceLead } = require("../services/workspaceService"); // Import the new function
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
// const { v4: uuidv4 } = require("uuid");
// const supabase = require("./database");
// const fetchPublicEmailDomains = require("../data/listOfEmailDomains");

// async function analyzeMeetings(userId) {
//   console.log("Running analyzeMeetings for user id:", userId);

//   // Fetch the list of public email domains
//   let publicEmailDomains = await fetchPublicEmailDomains();
//   console.log("Public email domains fetched:", publicEmailDomains);

//   // Fetch the user's email and domain information once
//   const userDetails = await getUserEmailAndDomain(userId);
//   console.log("User email and domain fetched:", userDetails);

//   // Retrieve the meetings and the attendees related to a specific user
//   let { data: meetings } = await supabase
//     .from("meetings")
//     .select(
//       `
//       id,
//       summary,
//       creator_email,
//       organizer_email,
//       start_dateTime,
//       end_dateTime,
//       start_time_zone,
//       end_time_zone,
//       collab_user_id,
//       meeting_attendees:meeting_attendees!meeting_id (
//         meeting_id,
//         email,
//         organizer,
//         response_status
//       )
//     `
//     )
//     .eq("collab_user_id", userId);
//   console.log("User meetings fetched:", meetings);

//   // Sort meetings by start_dateTime
//   meetings.sort(
//     (a, b) => new Date(a.start_dateTime) - new Date(b.start_dateTime)
//   );
//   console.log("Meetings sorted by start dateTime:", meetings);

//   // Prepare list of attendee emails and meeting attendees map for quick lookup
//   const attendeeEmails = new Set();
//   const meetingAttendeesMap = new Map();

//   for (let meeting of meetings) {
//     // Add creator and organizer to the attendees list
//     let attendees = [
//       ...meeting.meeting_attendees,
//       { email: meeting.creator_email },
//       { email: meeting.organizer_email },
//     ];

//     // Filter attendees based on their email domains
//     const filteredAttendees = filterAttendees(
//       attendees,
//       publicEmailDomains,
//       userDetails
//     );
//     console.log(
//       "Filtered attendees for meeting:",
//       meeting.id,
//       filteredAttendees
//     );
//     meeting.meeting_attendees = filteredAttendees;

//     // Add attendees' emails to the set for batch querying
//     for (let attendee of filteredAttendees) {
//       attendeeEmails.add(attendee.email);
//     }

//     // Map meeting ID to its attendees for later use
//     meetingAttendeesMap.set(meeting.id, filteredAttendees);
//   }
//   console.log(
//     "Filtered attendees:",
//     attendeeEmails.size,
//     "Emails:",
//     Array.from(attendeeEmails)
//   );

//   // Fetch all matching attendees in a single query
//   const { data: existingAttendees } = await supabase
//     .from("attendees")
//     .select("*")
//     .in("attendee_email", Array.from(attendeeEmails));
//   console.log("Existing attendees fetched:", existingAttendees);

//   // Update attendees and meetings in batch
//   await updateAttendeesAndMeetings(
//     existingAttendees,
//     meetings,
//     meetingAttendeesMap,
//     userId,
//     userDetails
//   );
//   console.log("Attendees and meetings updated.");

//   return meetings;
// }

// // This function will retrieve the email and domain of the collab user
// async function getUserEmailAndDomain(userId) {
//   let { data, error } = await supabase
//     .from("collab_users")
//     .select("collab_user_email")
//     .eq("id", userId)
//     .single();

//   if (error) {
//     console.error("Error fetching collab user email:", error);
//     return null;
//   }

//   let domain = data.collab_user_email.split("@")[1];
//   return { email: data.collab_user_email, domain };
// }

// // This function filters the attendees based on their email domain
// function filterAttendees(attendees, publicEmailDomains, userDetails) {
//   let filteredAttendees = [];
//   for (let attendee of attendees) {
//     let attendeeDomain = attendee.email.split("@")[1];

//     if (publicEmailDomains.includes(attendeeDomain)) {
//       if (attendee.email !== userDetails.email) {
//         filteredAttendees.push(attendee);
//       }
//     } else if (attendeeDomain !== userDetails.domain) {
//       filteredAttendees.push(attendee);
//     }
//   }
//   return filteredAttendees;
// }

// // This function updates the attendees and meetings tables in the database
// async function updateAttendeesAndMeetings(
//   existingAttendees,
//   meetings,
//   meetingAttendeesMap,
//   userId,
//   userDetails
// ) {
//   // Create a map of existing attendees for quick lookup
//   const existingAttendeesMap = new Map();
//   const domainWorkspaceMap = new Map(); // Track workspaceId for each domain
//   const meetingWorkspaceMap = new Map(); // Track workspaceId for each meeting

//   for (let attendee of existingAttendees) {
//     existingAttendeesMap.set(attendee.attendee_email, attendee);
//     let domain = attendee.attendee_email.split("@")[1]; // Extract domain
//     // If workspace_id exists and it's not mapped for this domain yet
//     if (attendee.workspace_id && !domainWorkspaceMap.get(domain)) {
//       domainWorkspaceMap.set(domain, attendee.workspace_id);
//     }
//   }

//   console.log("Existing attendees map:", existingAttendeesMap);

//   // Prepare lists for batch update and insert operations
//   const attendeesToInsert = [];
//   const meetingsToUpdate = [];
//   const workspacesToCreate = [];

//   for (let meeting of meetings) {
//     console.log("Processing meeting:", meeting.id);
//     let workspaceId = null;
//     const attendeesForThisMeeting = meetingAttendeesMap.get(meeting.id);

//     // If any attendee has a workspace, use it.
//     for (let attendee of attendeesForThisMeeting) {
//       if (existingAttendeesMap.has(attendee.email)) {
//         workspaceId = existingAttendeesMap.get(attendee.email).workspace_id;
//         if (workspaceId) {
//           break;
//         }
//       }
//     }

//     // If there is no existing workspaceId, then assign a lead and create a workspace
//     if (!workspaceId) {
//       console.log("No existing workspaceId found for meeting:", meeting.id);
//       // Check if workspaceId exists for this meeting
//       workspaceId = meetingWorkspaceMap.get(meeting.id);

//       if (!workspaceId) {
//         console.log("No workspaceId found for meeting:", meeting.id);
//         // Assign workspace lead
//         const leadAssigned = assignWorkspaceLead(
//           attendeesForThisMeeting,
//           meeting
//         );

//         if (leadAssigned) {
//           console.log(`Workspace lead assigned for meeting: ${meeting.id}`);

//           let leadDomain = leadAssigned.email.split("@")[1]; // Extract lead's domain
//           workspaceId = domainWorkspaceMap.get(leadDomain); // Check if workspaceId exists for this domain

//           // If no workspaceId exists for this domain, create one
//           if (!workspaceId) {
//             console.log(
//               `No workspaceId found for domain ${leadDomain}. Creating a new workspace for meeting: ${meeting.id}`
//             );
//             // Create a new workspace_id
//             workspaceId = uuidv4();

//             // Store the workspaceId and userId in workspacesToCreate array
//             workspacesToCreate.push({
//               workspace_id: workspaceId,
//               collab_user_id: userId,
//             });

//             console.log(
//               `Workspace created: ${workspaceId} for meeting: ${meeting.id}`
//             );

//             // Map the meeting ID and lead's domain to its workspaceId
//             domainWorkspaceMap.set(leadDomain, workspaceId);
//           }

//           meetingWorkspaceMap.set(meeting.id, workspaceId);

//           // Update the workspace_id for the meeting
//           meeting.workspace_id = workspaceId;
//           meetingsToUpdate.push(meeting);

//           // Update the workspace_id for the attendees
//           for (let attendee of attendeesForThisMeeting) {
//             let attendeeEntry = {
//               collab_user_id: userId,
//               workspace_id: workspaceId,
//               attendee_email: attendee.email,
//               attendee_is_workspace_lead:
//                 attendee.email === leadAssigned.email ? true : false,
//             };

//             // Check in memory first before inserting
//             if (
//               !existingAttendeesMap.has(attendee.email) &&
//               !attendeesToInsert.find(
//                 (a) => a.attendee_email === attendee.email
//               )
//             ) {
//               attendeesToInsert.push(attendeeEntry);
//               existingAttendeesMap.set(attendee.email, attendee);
//               console.log(
//                 "Added attendee to attendeesToInsert and existingAttendeesMap:",
//                 existingAttendeesMap
//               );
//             }
//           }
//         } else {
//           console.log(
//             "No workspace lead could be assigned for meeting:",
//             meeting.id
//           );
//         }
//       } else {
//         // workspaceId exists, so update the meeting with the workspaceId
//         console.log("Using existing workspaceId for meeting:", meeting.id);
//         meeting.workspace_id = workspaceId;
//         meetingsToUpdate.push(meeting);
//       }
//     }
//   }

//   // Perform batch insert and update operations
//   if (attendeesToInsert.length > 0) {
//     let insertResult = await supabase
//       .from("attendees")
//       .upsert(attendeesToInsert);
//     console.log("Insert attendees result:", insertResult);
//   }

//   if (meetingsToUpdate.length > 0) {
//     await Promise.all(
//       meetingsToUpdate.map((meeting) => {
//         let updateResult = supabase
//           .from("meetings")
//           .update({ workspace_id: meeting.workspace_id })
//           .eq("id", meeting.id);
//         console.log("Update meeting result:", updateResult);
//         return updateResult;
//       })
//     );
//   }

//   if (workspacesToCreate.length > 0) {
//     const { data, error } = await supabase
//       .from("workspaces")
//       .upsert(workspacesToCreate);
//     if (error) console.log("Error in creating workspace: ", error);
//     else console.log("Workspaces created successfully: ", data);
//   }
// }

// // This function assigns the attendee_is_workspace_lead flag based on the given rules
// function assignWorkspaceLead(attendeesForThisMeeting, meeting) {
//   // Iterate over attendees amd use cascading logic
//   for (let attendee of attendeesForThisMeeting) {
//     if (attendee.email === meeting.organizer_email) {
//       return attendee;
//     }

//     if (attendee.email === meeting.creator_email) {
//       return attendee;
//     }

//     if (attendee.response_status === "accepted") {
//       return attendee;
//     }
//   }

//   // If no suitable lead is found, assign the first attendee
//   return attendeesForThisMeeting[0];
// }

// module.exports = {
//   analyzeMeetings,
// };

// const analyzeMeetings = async (userId) => {
//   try {
//     const publicEmailDomains = await fetchPublicEmailDomains();
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

//         let workspaceId;
//         if (publicEmailDomains.includes(domain)) {
//           workspaceId = await handlePublicDomain(email, userId);
//         } else {
//           workspaceId = await handlePrivateDomain(email, userId);
//         }

//         if (workspaceId) {
//           // Append the workspaceId to the meeting object
//           meeting.workspace_id = workspaceId;

//           // Upsert the workspaceId into the meetings table
//           const { error } = await supabase
//             .from("meetings")
//             .upsert([{ id: meeting.id, workspace_id: workspaceId }], {
//               onConflict: "id",
//             });

//           if (error) console.log("Error upserting workspace_id:", error);
//         }

//         if (!workspaceId) continue;

//         const attendeeId = await checkAttendee(email, userId, workspaceId);
//         if (!attendeeId) continue;

//         // Call the assignWorkspaceLead function here
//         await assignWorkspaceLead(email, workspaceId);
//       }
//     }

//     console.log("Function finished: analyzeMeetings");

//     return nextMeetings;
//   } catch (error) {
//     console.error("Error analyzing meetings:", error);
//   }
// };

// FULLY WORKING LATEST VERSION BEFORE CHANGES:
// const fetchPublicEmailDomains = require("../data/listOfEmailDomains");
// const { checkAttendee } = require("../models/attendees");
// const { assignWorkspaceLead } = require("../services/workspaceService"); // Import the new function
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
// const supabase = require("./database");

// const analyzeMeetings = async (userId) => {
//   try {
//     const publicEmailDomains = await fetchPublicEmailDomains();
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

//         let workspaceId;
//         if (publicEmailDomains.includes(domain)) {
//           workspaceId = await handlePublicDomain(email, userId);
//         } else {
//           workspaceId = await handlePrivateDomain(email, userId);
//         }

//         if (workspaceId) {
//           // Append the workspaceId to the meeting object
//           meeting.workspace_id = workspaceId;

//           // Upsert the workspaceId into the meetings table
//           const { error } = await supabase
//             .from("meetings")
//             .upsert([{ id: meeting.id, workspace_id: workspaceId }], {
//               onConflict: "id",
//             });

//           if (error) console.log("Error upserting workspace_id:", error);
//         }

//         if (!workspaceId) continue;

//         const attendeeId = await checkAttendee(email, userId, workspaceId);
//         if (!attendeeId) continue;

//         // Call the assignWorkspaceLead function here
//         await assignWorkspaceLead(email, workspaceId);
//       }
//     }

//     console.log("Function finished: analyzeMeetings");

//     return nextMeetings;
//   } catch (error) {
//     console.error("Error analyzing meetings:", error);
//   }
// };

// module.exports = {
//   analyzeMeetings,
// };
