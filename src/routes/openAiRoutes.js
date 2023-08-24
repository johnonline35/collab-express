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
  for (let attendeeInfo of attendeeInfos) {
    const promptText = convertToReadableText(
      attendeeInfo.experience,
      attendeeInfo.education
    );

    const completionPrompt = `Based on the education and career information provided: ${promptText} please list three rapport-building topics that could be used in conversation. Each topic should be a sentence or two and relate specifically to the individual's experiences or background.`;
    console.log("Completion prompt:", ompletionPrompt);

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: completionPrompt,
          },
        ],
        max_tokens: 350,
        stream: true,
      });

      if (completion && completion.choices && completion.choices.length > 0) {
        responses.push(completion.choices[0].message.content);
      } else {
        console.error("Unexpected completion structure:", completion);
      }
    } catch (error) {
      console.error("Error while fetching completion from OpenAI:", error);
      // If you want to send an error response to the client:
      // return res.status(500).send("Error fetching data from OpenAI");
    }
  }

  res.json({ responses }); // sending back the responses
});

module.exports = router;
