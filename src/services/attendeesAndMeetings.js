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
  const existingAttendeesMap = new Map();
  const existingDomainsMap = new Map();

  existingAttendees.forEach((attendee) => {
    existingAttendeesMap.set(attendee.attendee_email, attendee);

    const attendeeDomain = attendee.attendee_email.split("@")[1];

    if (!publicEmailDomains.includes(attendeeDomain)) {
      existingDomainsMap.set(attendeeDomain, attendee.workspace_id);
    }
  });

  console.log("Existing attendees map:", existingAttendeesMap);
  console.log("Existing domains map:", existingDomainsMap);

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
        // If the attendee is in the map and the ignore flag is set, skip this iteration
        if (
          existingAttendeesMap.has(attendee.email) &&
          existingAttendeesMap.get(attendee.email).ignore
        ) {
          continue;
        }

        const attendeeDomain = attendee.email.split("@")[1];

        if (
          existingAttendeesMap.has(attendee.email) ||
          existingDomainsMap.has(attendeeDomain)
        ) {
          if (existingAttendeesMap.has(attendee.email)) {
            workspaceId = existingAttendeesMap.get(attendee.email).workspace_id;
          } else if (existingDomainsMap.has(attendeeDomain)) {
            workspaceId = existingDomainsMap.get(attendeeDomain);
          }

          existingWorkspace = true;

          break;
        }
      }

      // If there is no existing workspace, then define a workspace lead, and create a workspace.
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

        // If leadAssigned already has a workspace, use it.
        if (existingLeadWorkspace) {
          workspaceId = existingLeadWorkspace;
        } else {
          // If not, generate a new UUID and create a new workspace
          workspaceId = uuidv4();
          // console.log("No existing workspace for lead, creating new workspace");

          workspacesToCreate.push({
            workspace_id: workspaceId,
            workspace_name: workspaceInfo.workspaceName,
            collab_user_id: userId,
            meeting_attendee_email: workspaceInfo.meetingAttendeeEmail,
            domain: workspaceInfo.workspaceDomain,
          });
        }
      }

      attendeesForThisMeeting.forEach((attendee) => {
        console.log("Processing attendee:", attendee.email);

        let supabaseTableAttendeesObjectAttendee = existingAttendeesMap.get(
          attendee.email
        );

        // If the attendee doesn't exist in existingAttendeesMap, add it
        if (!supabaseTableAttendeesObjectAttendee) {
          supabaseTableAttendeesObjectAttendee = {
            collab_user_id: userId,
            workspace_id: workspaceId,
            attendee_email: attendee.email,
            attendee_is_workspace_lead: attendee.email === leadAssigned?.email,
            attendee_domain: attendee.email.split("@")[1],
          };

          attendeesToInsert.push(supabaseTableAttendeesObjectAttendee);

          existingAttendeesMap.set(
            attendee.email,
            supabaseTableAttendeesObjectAttendee
          );
        }

        const attendeeDomain = attendee.email.split("@")[1];
        if (!publicEmailDomains.includes(attendeeDomain)) {
          existingDomainsMap.set(attendeeDomain, workspaceId);
        }
      });

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
    // console.log("Insert attendees result:", insertResult);
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
