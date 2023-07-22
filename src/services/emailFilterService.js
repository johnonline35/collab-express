const supabase = require("../db/supabase"); // assuming the supabase instance is also needed here

// This function will retrieve the email and domain of the collab user
async function getUserEmailAndDomain(userId) {
  let { data, error } = await supabase
    .from("collab_users")
    .select("collab_user_email")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching collab user email:", error);
    return null;
  }

  let domain = data.collab_user_email.split("@")[1];
  return { email: data.collab_user_email, domain };
}

// This function filters the attendees based on their email domain
function filterAttendees(attendees, publicEmailDomains, userDetails) {
  let filteredAttendees = [];
  for (let attendee of attendees) {
    let attendeeDomain = attendee.email.split("@")[1];

    if (publicEmailDomains.includes(attendeeDomain)) {
      if (attendee.email !== userDetails.email) {
        filteredAttendees.push(attendee);
      }
    } else if (attendeeDomain !== userDetails.domain) {
      filteredAttendees.push(attendee);
    }
  }
  return filteredAttendees;
}

module.exports = { getUserEmailAndDomain, filterAttendees };
