const { v4: uuidv4 } = require("uuid");
const supabase = require("../services/database");

const handlePublicDomain = async (email, userId) => {
  const domain = email.split("@")[1];
  console.log("handlePublicDomain email:", email);
  console.log("handlePublicDomain domain:", domain);
  let workspaceName = email
    .split("@")[0]
    .replace(".", " ")
    .replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());

  let { data, error } = await supabase
    .from("workspaces")
    .select("workspace_id")
    .eq("meeting_attendee_email", email);

  if (error) {
    console.error("Error fetching workspace:", error);
    return null;
  }

  let workspaceId;
  if (data.length === 0) {
    // Workspace not found, create a new one
    workspaceId = uuidv4();

    let workspaceData = {
      workspace_id: workspaceId,
      meeting_attendee_email: email,
      workspace_name: workspaceName,
      collab_user_id: userId, // Use userId here
    };

    let { data: upsertData, error: workspaceUpsertError } = await supabase
      .from("workspaces")
      .upsert([workspaceData]);

    if (workspaceUpsertError) {
      console.error("Error upserting workspace:", workspaceUpsertError);
      return null;
    }
  } else {
    workspaceId = data[0].workspace_id;
  }

  return workspaceId;
};

const handlePrivateDomain = async (email, userId) => {
  const domain = email.split("@")[1];
  console.log("handlePrivateDomain email:", email);
  console.log("handlePrivateDomain domain:", domain);
  let workspaceName = domain.split(".")[0];
  workspaceName =
    workspaceName.charAt(0).toUpperCase() + workspaceName.slice(1); // Capitalize the first letter

  let { data, error } = await supabase
    .from("workspaces")
    .select("workspace_id")
    .eq("domain", domain);

  if (error) {
    console.error("Error fetching workspace:", error);
    return null;
  }

  let workspaceId;
  if (data.length === 0) {
    // Workspace not found, create a new one
    workspaceId = uuidv4();

    let workspaceData = {
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      domain: domain,
      collab_user_id: userId,
    };

    let { data: upsertData, error: workspaceUpsertError } = await supabase
      .from("workspaces")
      .upsert([workspaceData]);

    if (workspaceUpsertError) {
      console.error("Error upserting workspace:", workspaceUpsertError);
      return null;
    }
  } else {
    workspaceId = data[0].workspace_id;
  }

  return workspaceId;
};

// const handlePublicDomain = async (email, userId) => {
//   const domain = email.split("@")[1];
//   console.log("handlePublicDomain email:", email);
//   console.log("handlePublicDomain domain:", domain);
//   let workspaceName = email
//     .split("@")[0]
//     .replace(".", " ")
//     .replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());

//   let { data, error } = await supabase
//     .from("workspaces")
//     .select("workspace_id")
//     .eq("meeting_attendee_email", email);

//   if (error) {
//     console.error("Error fetching workspace:", error);
//     return null;
//   }

//   let workspaceId;
//   if (data.length === 0) {
//     // Workspace not found, create a new one
//     workspaceId = uuidv4();

//     let workspaceData = {
//       workspace_id: workspaceId,
//       meeting_attendee_email: email,
//       workspace_name: workspaceName,
//       collab_user_id: userId, // Use userId here
//     };

//     let { data: upsertData, error: workspaceUpsertError } = await supabase
//       .from("workspaces")
//       .upsert([workspaceData]);

//     if (workspaceUpsertError) {
//       console.error("Error upserting workspace:", workspaceUpsertError);
//       return null;
//     }
//   } else {
//     workspaceId = data[0].workspace_id;
//   }

//   return workspaceId;
// };

// const handlePrivateDomain = async (email, userId) => {
//   const domain = email.split("@")[1];
//   console.log("handlePrivateDomain email:", email);
//   console.log("handlePrivateDomain domain:", domain);
//   let workspaceName = domain.split(".")[0];
//   workspaceName =
//     workspaceName.charAt(0).toUpperCase() + workspaceName.slice(1); // Capitalize the first letter

//   let { data, error } = await supabase
//     .from("workspaces")
//     .select("workspace_id")
//     .eq("domain", domain);

//   if (error) {
//     console.error("Error fetching workspace:", error);
//     return null;
//   }

//   let workspaceId;
//   if (data.length === 0) {
//     // Workspace not found, create a new one
//     workspaceId = uuidv4();

//     let workspaceData = {
//       workspace_id: workspaceId,
//       workspace_name: workspaceName,
//       domain: domain,
//       collab_user_id: userId,
//     };

//     let { data: upsertData, error: workspaceUpsertError } = await supabase
//       .from("workspaces")
//       .upsert([workspaceData]);

//     if (workspaceUpsertError) {
//       console.error("Error upserting workspace:", workspaceUpsertError);
//       return null;
//     }
//   } else {
//     workspaceId = data[0].workspace_id;
//   }

//   return workspaceId;
// };

module.exports = {
  handlePublicDomain,
  handlePrivateDomain,
};
