const axios = require("axios");
const { jobManagerEndpoint } = require("../data/collabUrls");

async function enrichWorkspacesAndAttendees(
  workspacesToEnrich,
  attendeesToEnrich,
  userId
) {
  try {
    // Process workspacesToEnrich
    for (let workspace of workspacesToEnrich) {
      //   console.log({ workspaceID: workspace.workspace_id });
      const response = await axios.post(jobManagerEndpoint, workspace);
      // Handle response if necessary
      // For example: if(response.status !== 200) { /* Handle error */ }
    }

    // Process attendeesToEnrich
    for (let attendee of attendeesToEnrich) {
      //   console.log({ attendeeID: attendee.attendee_id });
      const response = await axios.post(jobManagerEndpoint, attendee);
      // Handle response if necessary
    }

    const { error } = await supabase
      .from("collab_users")
      .update({ initial_enrichment_complete: true })
      .eq("id", userId);

    if (error) {
      throw error; // If there's an error updating the table, throw it
    }

    return true; // Successfully enriched both workspaces and attendees
  } catch (err) {
    console.error("Error during enrichment:", err);
    return false; // Indicate a failure in enrichment
  }
}

module.exports = {
  enrichWorkspacesAndAttendees,
};
