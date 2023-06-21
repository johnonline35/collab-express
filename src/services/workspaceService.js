const supabase = require("supabase"); // Assume supabase is imported properly
const { publicEmailDomains } = require("../data/listOfEmailDomains");

const assignWorkspaceLead = async (email, workspaceId) => {
  try {
    // Extract domain from email
    const emailDomain = email.split("@")[1];

    // Fetch attendees with the given email and workspaceId
    let { data: attendees, error } = await supabase
      .from("attendees")
      .select("attendee_id, attendee_email")
      .eq("attendee_email", email)
      .eq("workspace_id", workspaceId);

    if (error) {
      console.error("Error fetching attendee:", error);
      return null;
    }

    // Step 1: Check if the domain is public
    if (publicEmailDomains.includes(emailDomain)) {
      await supabase.from("attendees").upsert([
        {
          attendee_id: attendees[0].attendee_id,
          attendee_is_workspace_lead: true,
        },
      ]);
      return;
    }

    // Step 2: Check domain and see if there is more than 1 result for that domain
    let { data: domainAttendees } = await supabase
      .from("attendees")
      .select("attendee_email")
      .eq("workspace_id", workspaceId);

    const attendeeDomainEmails = domainAttendees.map((a) => a.attendee_email);
    const matchingMeetingAttendees = await supabase
      .from("meeting_attendees")
      .select("email, organizer, response_status")
      .in("email", attendeeDomainEmails);

    // Step 3 and 4: Check meeting_attendees table
    let organizerAttendee = null;
    let firstPositiveResponseAttendee = null;

    for (let attendee of matchingMeetingAttendees) {
      if (attendee.organizer) {
        organizerAttendee = attendee.email;
        break;
      } else if (attendee.response_status) {
        firstPositiveResponseAttendee = attendee.email;
      }
    }

    let leadEmail = organizerAttendee || firstPositiveResponseAttendee;
    if (leadEmail) {
      await supabase.from("attendees").upsert([
        {
          attendee_id: attendees[0].attendee_id,
          attendee_is_workspace_lead: leadEmail === email,
        },
      ]);

      // Ensure only one attendee_is_workspace_lead is set to true
      await supabase
        .from("attendees")
        .update({
          attendee_is_workspace_lead: false,
        })
        .eq("workspace_id", workspaceId)
        .neq("attendee_email", leadEmail);
    }
  } catch (error) {
    console.error("Error in assignWorkspaceLead:", error);
  }
};

module.exports = {
  assignWorkspaceLead,
};
