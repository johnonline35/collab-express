const { v4: uuidv4 } = require("uuid");
const supabase = require("../db/supabase");
const {
  assignWorkspaceLead,
  createWorkspaceName,
} = require("../handlers/workspaceHandler");

// This function updates the attendees and meetings tables in the database
async function updateAttendeesAndMeetings(
  existingAttendees,
  meetings,
  meetingAttendeesMap,
  userId,
  userDetails,
  publicEmailDomains
) {
  // Input validation
  if (!Array.isArray(existingAttendees)) {
    console.error("Invalid input for existingAttendees:", existingAttendees);
    throw new Error("existingAttendees must be an array");
  }
  if (!Array.isArray(meetings)) {
    console.error("Invalid input for meetings:", meetings);
    throw new Error("meetings must be an array");
  }
  if (!(meetingAttendeesMap instanceof Map)) {
    console.error(
      "Invalid input for meetingAttendeesMap:",
      meetingAttendeesMap
    );
    throw new Error("meetingAttendeesMap must be a Map");
  }

  const existingAttendeesMap = new Map();
  const existingDomainsMap = new Map();

  existingAttendees.forEach((attendee) => {
    existingAttendeesMap.set(attendee.attendee_email, attendee);
    const attendeeDomain = attendee.attendee_email.split("@")[1];
    if (!publicEmailDomains.includes(attendeeDomain)) {
      existingDomainsMap.set(attendeeDomain, attendee.workspace_id);
    }
  });

  const attendeesToInsert = [];
  const meetingsToUpdate = [];
  const workspacesToCreate = [];

  for (let meeting of meetings) {
    const attendeesForThisMeeting = meetingAttendeesMap.get(meeting.id);

    if (attendeesForThisMeeting.length > 0) {
      let workspaceId;
      let leadAssigned = null;
      let existingWorkspace = null;

      for (let attendee of attendeesForThisMeeting) {
        const attendeeDomain = attendee.email.split("@")[1];
        if (
          existingAttendeesMap.has(attendee.email) ||
          existingDomainsMap.has(attendeeDomain)
        ) {
          workspaceId = existingAttendeesMap.has(attendee.email)
            ? existingAttendeesMap.get(attendee.email).workspace_id
            : existingDomainsMap.get(attendeeDomain);
          existingWorkspace = true;
          break;
        }
      }

      // If there is no existing workspace, then define a workspace lead, and create a workspace
      if (!existingWorkspace) {
        leadAssigned = assignWorkspaceLead(attendeesForThisMeeting, meeting);
        let workspaceInfo = createWorkspaceName(
          leadAssigned.email,
          publicEmailDomains
        );

        // Check if leadAssigned already has a workspace_id
        let existingLeadWorkspace = existingAttendeesMap.get(
          leadAssigned.email
        )?.workspace_id;

        workspaceId = existingLeadWorkspace ? existingLeadWorkspace : uuidv4();

        // Only push new workspace to be created if it's a new workspace_id
        if (!existingLeadWorkspace) {
          workspacesToCreate.push({
            workspace_id: workspaceId,
            workspace_name: workspaceInfo.workspaceName,
            collab_user_id: userId,
            meeting_attendee_email: workspaceInfo.meetingAttendeeEmail,
            domain: workspaceInfo.workspaceDomain,
          });
        }
      }
      //   if (!existingWorkspace) {
      //     leadAssigned = assignWorkspaceLead(attendeesForThisMeeting, meeting);
      //     let workspaceInfo = createWorkspaceName(
      //       leadAssigned.email,
      //       publicEmailDomains
      //     );
      //     workspaceId = uuidv4();

      //     workspacesToCreate.push({
      //       workspace_id: workspaceId,
      //       workspace_name: workspaceInfo.workspaceName,
      //       collab_user_id: userId,
      //       meeting_attendee_email: workspaceInfo.meetingAttendeeEmail,
      //       domain: workspaceInfo.workspaceDomain,
      //     });
      //   }
      attendeesForThisMeeting.forEach((attendee) => {
        const attendeeDomain = attendee.email.split("@")[1];

        if (!existingAttendeesMap.has(attendee.email)) {
          attendeesToInsert.push({
            collab_user_id: userId,
            workspace_id: workspaceId,
            attendee_email: attendee.email,
            attendee_is_workspace_lead: attendee.email === leadAssigned?.email,
            attendee_domain: attendeeDomain,
          });
          existingAttendeesMap.set(attendee.email, attendee);
          if (!publicEmailDomains.includes(attendeeDomain)) {
            existingDomainsMap.set(attendeeDomain, workspaceId);
          }
        } else {
          // update workspace_id for existing attendees
          const existingAttendee = existingAttendeesMap.get(attendee.email);
          existingAttendee.workspace_id = workspaceId;
        }
      });

      //   attendeesForThisMeeting.forEach((attendee) => {
      //     if (!existingAttendeesMap.has(attendee.email)) {
      //       attendeesToInsert.push({
      //         collab_user_id: userId,
      //         workspace_id: workspaceId,
      //         attendee_email: attendee.email,
      //         attendee_is_workspace_lead: attendee.email === leadAssigned?.email,
      //         attendee_domain: attendee.email.split("@")[1],
      //       });
      //       existingAttendeesMap.set(attendee.email, attendee);
      //       const attendeeDomain = attendee.email.split("@")[1];
      //       if (!publicEmailDomains.includes(attendeeDomain)) {
      //         existingDomainsMap.set(attendeeDomain, workspaceId);
      //       }
      //     }
      //   });

      meetingsToUpdate.push({
        id: meeting.id,
        workspace_id: workspaceId,
      });
    }
  }

  if (attendeesToInsert.length > 0) {
    let { data: insertResult, error } = await supabase
      .from("attendees")
      .upsert(attendeesToInsert);
    console.log("Insert attendees result:", insertResult);
    if (error) console.log("Error inserting attendees:", error);
  }

  if (meetingsToUpdate.length > 0) {
    await Promise.all(
      meetingsToUpdate.map((meeting) => {
        let updateResult = supabase
          .from("meetings")
          .update({ workspace_id: meeting.workspace_id })
          .eq("id", meeting.id);
        // console.log("Update meeting result:", updateResult);
        return updateResult;
      })
    );
  }

  if (workspacesToCreate.length > 0) {
    const { data, error } = await supabase
      .from("workspaces")
      .upsert(workspacesToCreate);
    if (error) console.log("Error in creating workspace: ", error);
    // else console.log("Workspaces created successfully: ", data);
  }
}

module.exports = {
  updateAttendeesAndMeetings,
};
