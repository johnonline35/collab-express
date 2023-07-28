// This function assigns the attendee_is_workspace_lead flag based on the given rules
function assignWorkspaceLead(attendeesForThisMeeting, meeting) {
  if (!attendeesForThisMeeting || attendeesForThisMeeting.length === 0) {
    throw new Error("No attendees available to assign as lead.");
  }

  console.log(`Meeting ID: ${meeting.id}`);

  let organizers = [];
  let creators = [];
  let acceptedAttendees = [];
  let needsActionAttendees = [];
  let declinedAttendees = [];
  let firstAttendee = attendeesForThisMeeting[0];

  // Iterate over attendees and use cascading logic
  for (let attendee of attendeesForThisMeeting) {
    console.log(`Evaluating attendee: ${JSON.stringify(attendee)}`);

    if (attendee.email === meeting.organizer_email) {
      organizers.push(attendee);
      console.log(`Organizer found: ${JSON.stringify(attendee)}`);
    }

    if (attendee.email === meeting.creator_email) {
      creators.push(attendee);
      console.log(`Creator found: ${JSON.stringify(attendee)}`);
    }

    if (attendee.response_status === "accepted") {
      acceptedAttendees.push(attendee);
      console.log(`Accepted attendee found: ${JSON.stringify(attendee)}`);
    }

    if (attendee.response_status === "needsAction") {
      needsActionAttendees.push(attendee);
      console.log(`Attendee needs action: ${JSON.stringify(attendee)}`);
    }

    if (attendee.response_status === "declined") {
      declinedAttendees.push(attendee);
      console.log(`Attendee declined: ${JSON.stringify(attendee)}`);
    }
  }

  // Assign lead based on priority
  if (organizers.length > 0) {
    console.log(`Assigned lead (organizer): ${JSON.stringify(organizers[0])}`);
    return organizers[0];
  } else if (creators.length > 0) {
    console.log(`Assigned lead (creator): ${JSON.stringify(creators[0])}`);
    return creators[0];
  } else if (acceptedAttendees.length > 0) {
    console.log(
      `Assigned lead (accepted): ${JSON.stringify(acceptedAttendees[0])}`
    );
    return acceptedAttendees[0];
  } else if (firstAttendee) {
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
