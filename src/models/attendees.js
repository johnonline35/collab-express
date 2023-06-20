const { v4: uuidv4 } = require("uuid");
const supabase = require("../services/database");

// Check attendee
const checkAttendee = async (email, workspaceId) => {
  try {
    let { data: attendees, error } = await supabase
      .from("attendees")
      .select("attendee_id")
      .eq("attendee_email", email);

    if (error) {
      console.error("Error fetching attendee:", error);
      return null;
    }

    let attendeeId;

    if (attendees.length === 0) {
      // Attendee not found, create a new one
      attendeeId = uuidv4();

      let { data: upsertedAttendee, error: attendeeUpsertError } =
        await supabase.from("attendees").upsert([
          {
            attendee_id: attendeeId,
            attendee_email: email,
            workspace_id: workspaceId,
          },
        ]);

      if (attendeeUpsertError) {
        console.error("Error upserting attendee:", attendeeUpsertError);
        return null;
      }
    } else {
      // Use the first attendee if it exists
      attendeeId = attendees[0].attendee_id;
    }

    return attendeeId;
  } catch (error) {
    console.error("Error in checkAttendee:", error);
    return null;
  }
};

module.exports = {
  checkAttendee,
  // Other attendee related functions
};
