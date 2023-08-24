const express = require("express");
const router = express.Router();
const openai = require("../api/openAi");
const { fetchAttendeeData } = require("../utils/database");
const { convertToReadableText } = require("../utils/helper");

router.post("/summarize-career-education", async (req, res) => {
  const meetingData = req.body[0];
  const attendees = meetingData.attendees;

  const attendeeInfos = [];

  for (let attendee of attendees) {
    const attendeeInfo = await fetchAttendeeData(attendee.attendee_email);
    attendeeInfos.push(attendeeInfo);
  }

  const responses = [];
  for (let i = 0; i < attendeeInfos.length; i++) {
    const attendeeInfo = attendeeInfos[i];
    const attendee = attendees[i]; // Assuming the ordering has remained consistent

    const promptText = convertToReadableText(
      attendeeInfo.experience,
      attendeeInfo.education,
      attendee
    );

    const completionPrompt = `Based on the education and career information provided: ${promptText} please list three rapport-building topics that could be used in conversation. Each topic should be a sentence or two and relate specifically to the individual's experiences or background.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: completionPrompt,
        },
      ],
      max_tokens: 350,
    });

    responses.push(completion.choices[0].message.content);
  }

  res.json({ attendeeResponses: responses });
});

module.exports = router;
