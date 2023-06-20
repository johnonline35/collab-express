const supabase = require("../services/database");

// Fetch future meetings
const fetchFutureMeetings = async () => {
  try {
    let { data: futureMeetings, error } = await supabase
      .from("meetings")
      .select("id")
      .gte("start_dateTime", new Date().toISOString())
      .order("start_dateTime", { ascending: true })
      .limit(8);

    if (error) {
      console.error("Error fetching future meetings:", error);
      return [];
    }

    return futureMeetings;
  } catch (error) {
    console.error("Error in fetchFutureMeetings:", error);
    return [];
  }
};

// Fetch past meetings
const fetchPastMeetings = async (currentMeetingsCount) => {
  try {
    let { data: pastMeetings, error } = await supabase
      .from("meetings")
      .select("id")
      .lt("start_dateTime", new Date().toISOString())
      .order("start_dateTime", { ascending: false }) // Ordering by descending to get most recent past meetings
      .limit(8 - currentMeetingsCount); // Fetch the remaining number of meetings to reach 8

    if (error) {
      console.error("Error fetching past meetings:", error);
      return [];
    }

    return pastMeetings;
  } catch (error) {
    console.error("Error in fetchPastMeetings:", error);
    return [];
  }
};

// Fetch meeting details
const fetchMeetingDetails = async (meetingId) => {
  try {
    let { data: meetingDetails, error } = await supabase
      .from("meetings")
      .select("creator_email, organizer_email")
      .eq("id", meetingId);

    if (error) {
      console.error(
        `Error fetching meeting details for meeting id: ${meetingId}:`,
        error
      );
      return null;
    }

    return meetingDetails;
  } catch (error) {
    console.error("Error in fetchMeetingDetails:", error);
    return null;
  }
};

// Fetch meeting attendees
const fetchMeetingAttendees = async (meetingId) => {
  try {
    let { data: attendees, error } = await supabase
      .from("meeting_attendees")
      .select("email")
      .eq("meeting_id", meetingId);

    if (error) {
      console.error(
        `Error fetching attendees for meeting id: ${meetingId}:`,
        error
      );
      return [];
    }

    return attendees;
  } catch (error) {
    console.error("Error in fetchMeetingAttendees:", error);
    return [];
  }
};

module.exports = {
  fetchFutureMeetings,
  fetchPastMeetings,
  fetchMeetingDetails,
  fetchMeetingAttendees,
};
