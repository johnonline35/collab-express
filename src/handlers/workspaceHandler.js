// This function assigns the attendee_is_workspace_lead flag based on the given rules
function assignWorkspaceLead(attendeesForThisMeeting, meeting) {
  if (!attendeesForThisMeeting || attendeesForThisMeeting.length === 0) {
    throw new Error("No attendees available to assign as lead.");
  }

  console.log(`Meeting ID: ${meeting.id}`);

  let lead = null;
  let firstAttendee = attendeesForThisMeeting[0];

  for (let attendee of attendeesForThisMeeting) {
    console.log(`Evaluating attendee: ${JSON.stringify(attendee)}`);

    if (attendee.email === meeting.organizer_email) {
      console.log(`Found lead (organizer): ${JSON.stringify(attendee)}`);
      lead = attendee;
      break;
    }

    if (attendee.email === meeting.creator_email && lead === null) {
      console.log(`Found lead (creator): ${JSON.stringify(attendee)}`);
      lead = attendee;
      continue;
    }

    if (attendee.response_status === "accepted" && lead === null) {
      console.log(`Found lead (accepted): ${JSON.stringify(attendee)}`);
      lead = attendee;
    }
  }

  if (lead !== null) {
    console.log(`Assigned lead: ${JSON.stringify(lead)}`);
    return lead;
  }

  if (firstAttendee) {
    console.log(
      `Assigned lead (first attendee): ${JSON.stringify(firstAttendee)}`
    );
    return firstAttendee;
  }

  throw new Error("No suitable lead found");
}

function createWorkspaceName(leadEmail, publicEmailDomains) {
  // Ensure leadEmail is valid
  if (!leadEmail.includes("@")) {
    throw new Error("Invalid leadEmail. Unable to create workspace name");
  }
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
