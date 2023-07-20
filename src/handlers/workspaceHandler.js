// This function assigns the attendee_is_workspace_lead flag based on the given rules
function assignWorkspaceLead(attendeesForThisMeeting, meeting) {
  // Iterate over attendees amd use cascading logic
  for (let attendee of attendeesForThisMeeting) {
    if (attendee.email === meeting.organizer_email) {
      return attendee;
    }

    if (attendee.email === meeting.creator_email) {
      return attendee;
    }

    if (attendee.response_status === "accepted") {
      return attendee;
    }
  }

  // If no suitable lead is found, assign the first attendee
  return attendeesForThisMeeting[0];
}

function createWorkspaceName(leadEmail, publicEmailDomains) {
  // Split the email address into user and domain
  let [user, domain] = leadEmail.split("@");

  // Split the domain name to exclude the extension
  let domainName = domain.split(".")[0];

  let baseName;
  let meetingAttendeeEmail, workspaceDomain;
  if (publicEmailDomains.includes(domain)) {
    baseName = user;
    meetingAttendeeEmail = leadEmail;
  } else {
    baseName = domainName;
    workspaceDomain = domain;
  }

  // Capitalize the first letter of the base name
  let workspaceName = baseName.charAt(0).toUpperCase() + baseName.slice(1);

  return {
    workspaceName,
    meetingAttendeeEmail,
    workspaceDomain,
  };
}

module.exports = { assignWorkspaceLead, createWorkspaceName };
