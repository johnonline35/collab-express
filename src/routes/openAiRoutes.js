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

    const completionPrompt = `Based on the education and career information provided next, please list three rapport-building topics that could be used in conversation. Each topic should be a sentence or two and relate specifically to the individual's experiences or background - please focus on unusual things in the data I am about to give you next. There might be a lot of repetition in experience, in which case, please just summarize the experience into a theme that can be easily understood an talked about. The response should be in a bulleted or numbered list format, and I want only the three concise points without additional explanations. Here is the data to use for your response: ${promptText} `;
    console.log("Completion prompt:", completionPrompt);

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Please say hello",
          },
        ],
        // max_tokens: 350,
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
