// Helper function to convert experience and education into readable text
const convertToReadableText = (experience, education, attendee) => {
  let text = "";

  if (attendee && attendee.attendee_name) {
    text += `Attendee name: ${attendee.attendee_name}. `;
  }

  // Convert experience info
  experience.forEach((exp) => {
    text += `Worked as a ${exp.title_name} at ${exp.company_name} from ${exp.start_date} to ${exp.end_date}. `;
  });

  // Convert education info
  education.forEach((ed) => {
    text += `Studied ${ed.major} and got a ${ed.degree} from ${ed.school_name} from ${ed.start_date} to ${ed.end_date}. `;
  });

  return text;
};

module.exports = {
  convertToReadableText,
};
