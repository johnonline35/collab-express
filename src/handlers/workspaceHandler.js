// This function assigns the attendee_is_workspace_lead flag based on the given rules
function assignWorkspaceLead(attendeesForThisMeeting, meeting) {
  if (!attendeesForThisMeeting || attendeesForThisMeeting.length === 0) {
    throw new Error("No attendees available to assign as lead.");
  }

  console.log(`Meeting ID: ${meeting.id}`);

  let organizer = null;
  let creator = null;
  let accepted = null;
  let firstAttendee = null;

  // Iterate over attendees and use cascading logic
  for (let attendee of attendeesForThisMeeting) {
    console.log(`Checking attendee: ${JSON.stringify(attendee)}`);

    if (!firstAttendee) firstAttendee = attendee; // Set the first attendee if not set

    if (attendee.email === meeting.organizer_email && !organizer) {
      console.log(`Potential lead (organizer): ${JSON.stringify(attendee)}`);
      organizer = attendee;
    } else if (attendee.email === meeting.creator_email && !creator) {
      console.log(`Potential lead (creator): ${JSON.stringify(attendee)}`);
      creator = attendee;
    } else if (attendee.response_status === "accepted" && !accepted) {
      console.log(`Potential lead (accepted): ${JSON.stringify(attendee)}`);
      accepted = attendee;
    }
  }

  // Assign lead based on priority
  if (organizer) {
    console.log(`Assigned lead (organizer): ${JSON.stringify(organizer)}`);
    return organizer;
  } else if (creator) {
    console.log(`Assigned lead (creator): ${JSON.stringify(creator)}`);
    return creator;
  } else if (accepted) {
    console.log(`Assigned lead (accepted): ${JSON.stringify(accepted)}`);
    return accepted;
  } else if (firstAttendee) {
    console.log(
      `Assigned lead (first attendee): ${JSON.stringify(firstAttendee)}`
    );
    return firstAttendee;
  } else {
    throw new Error("No suitable lead found");
  }
}

// function assignWorkspaceLead(attendeesForThisMeeting, meeting) {
//   if (!attendeesForThisMeeting || attendeesForThisMeeting.length === 0) {
//     throw new Error("No attendees available to assign as lead.");
//   }

//   console.log(`Meeting ID: ${meeting.id}`);

//   // Iterate over attendees and use cascading logic
//   for (let attendee of attendeesForThisMeeting) {
//     console.log(`Checking attendee: ${JSON.stringify(attendee)}`);

//     if (attendee.email === meeting.organizer_email) {
//       console.log(`Assigned lead (organizer): ${JSON.stringify(attendee)}`);
//       return attendee;
//     }

//     if (attendee.email === meeting.creator_email) {
//       console.log(`Assigned lead (creator): ${JSON.stringify(attendee)}`);
//       return attendee;
//     }

//     if (attendee.response_status === "accepted") {
//       console.log(`Assigned lead (accepted): ${JSON.stringify(attendee)}`);
//       return attendee;
//     }
//   }

//   // If no suitable lead is found, assign the first attendee
//   // console.log(
//   //   `Assigned lead (first attendee): ${JSON.stringify(
//   //     attendeesForThisMeeting[0]
//   //   )}`
//   // );
//   return attendeesForThisMeeting[0];
// }

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
