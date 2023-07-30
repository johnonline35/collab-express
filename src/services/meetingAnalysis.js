const supabase = require("../db/supabase");
const { updateAttendeesAndMeetings } = require("./attendeesAndMeetings"); // Update the import statement
const fetchPublicEmailDomains = require("../data/listOfEmailDomains");
const {
  getUserEmailAndDomain,
  filterAttendees,
} = require("./emailFilterService"); // Import the functions

async function analyzeMeetings(userId) {
  // Fetch the list of public email domains
  let publicEmailDomains = await fetchPublicEmailDomains();
  // console.log("Public email domains fetched:", publicEmailDomains);

  // Fetch the user's email and domain information once
  const userDetails = await getUserEmailAndDomain(userId);

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

  // Prepare list of attendee emails and meeting attendees map for quick lookup
  const attendeeEmails = new Set();
  const meetingAttendeesMap = new Map();

  for (let meeting of meetings) {
    let attendees = [];

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

    // Filter attendees based on their email domains
    const filteredAttendees = filterAttendees(
      attendees,
      publicEmailDomains,
      userDetails
    );

    meeting.meeting_attendees = filteredAttendees;

    // Add attendees' emails to the set for batch querying
    for (let attendee of filteredAttendees) {
      attendeeEmails.add(attendee.email);
    }

    // Map meeting ID to its attendees for later use
    meetingAttendeesMap.set(meeting.id, filteredAttendees);
  }

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
      console.log("existingAttendees:", existingAttendees);
    } else {
      console.error("Error retrieving existing attendees:", result.error);
    }
  }

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
