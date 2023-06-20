const supabase = require("../services/database");

// Filter collab user emails
const filterCollabUserEmails = async (emails) => {
  try {
    let filteredEmails = await Promise.all(
      emails.map(async (email) => {
        let { data: collabUsers, error } = await supabase
          .from("collab_users")
          .select("collab_user_email")
          .eq("collab_user_email", email);

        if (error) {
          console.error("Error checking collab_users:", error);
          return email; // In case of error, include the email
        }

        // If the email doesn't match with any collab_user_email, include it
        if (collabUsers.length === 0) {
          return email;
        }

        // If the email matches with a collab_user_email, exclude it
        return null;
      })
    );

    // Remove any null values (which correspond to matching collab_user_emails)
    filteredEmails = filteredEmails.filter((email) => email !== null);

    return filteredEmails;
  } catch (error) {
    console.error("Error in filterCollabUserEmails:", error);
    return [];
  }
};

module.exports = {
  filterCollabUserEmails,
};
