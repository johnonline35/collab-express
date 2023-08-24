const convertToReadableText = (experience, education, attendee) => {
  let text = "";

  if (attendee && attendee.attendee_name) {
    text += `${attendee.attendee_name}'s career and education includes:\n\n`;
  }

  // Convert experience info in a structured manner
  text += "Career Highlights:\n";
  experience.forEach((exp) => {
    const endDate = exp.end_date || "present";
    text += `- ${exp.title_name} at ${exp.company_name} (${exp.start_date} - ${endDate}).\n`;
  });

  // Convert education info
  text += `\nEducation:\n`;
  education.forEach((ed) => {
    const startDate = ed.start_date || "unknown";
    const endDate = ed.end_date || "unknown";
    text += `- ${ed.degree} in ${ed.major} from ${ed.school_name} (${startDate} - ${endDate}).\n`;
  });

  return text;
};

function createCompletionPrompt(attendeeInfo, attendee) {
  const promptText = convertToReadableText(
    attendeeInfo.experience,
    attendeeInfo.education,
    attendee
  );
  return `Based on the education and career information ... ${promptText} `;
}

module.exports = {
  convertToReadableText,
  createCompletionPrompt,
};
