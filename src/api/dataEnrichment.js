const axios = require("axios");
const { jobManagerEndpoint } = require("../data/collabUrls");

async function enrichWorkspacesAndAttendees(
  workspacesToEnrich,
  attendeesToEnrich
) {
  try {
    // Process workspacesToEnrich
    for (let workspace of workspacesToEnrich) {
      console.log({ workspaceID: workspace.workspace_id });
      //   const response = await axios.post(jobManagerEndpoint, workspace);
      // Handle response if necessary
      // For example: if(response.status !== 200) { /* Handle error */ }
    }

    // Process attendeesToEnrich
    for (let attendee of attendeesToEnrich) {
      console.log({ attendeeID: attendee.attendee_id });
      //   const response = await axios.post(jobManagerEndpoint, attendee);
      // Handle response if necessary
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
