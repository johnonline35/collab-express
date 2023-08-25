const express = require("express");
const router = express.Router();
const { openai, fetchCompletionFromOpenAI } = require("../api/openAi");
const {
  fetchAttendeeData,
  fetchAllAttendeeInfos,
} = require("../utils/database");
const {
  convertToReadableText,
  createCompletionPrompt,
} = require("../utils/helper");
const ioConfig = require("./config/io");

router.post("/summarize-career-education", async (req, res) => {
  const io = ioConfig.getIo();
  const meetingData = req.body[0];
  const attendees = meetingData.attendees;
  const attendeeInfos = [];

  for (let attendee of attendees) {
    const attendeeInfo = await fetchAttendeeData(attendee.attendee_email);
    attendeeInfos.push(attendeeInfo);
  }

  for (let i = 0; i < attendeeInfos.length; i++) {
    const attendeeInfo = attendeeInfos[i];
    const attendee = attendees[i]; // Assuming the ordering has remained consistent

    const promptText = convertToReadableText(
      attendeeInfo.experience,
      attendeeInfo.education,
      attendee
    );

    //     const completionPrompt = `Based on the education and career information provided, please list three rapport-building topics that could be used in conversation. Please be descriptive and use the subjects name at the start of the response for the first bullet and then use their gender "he/him or she/her" if you are able to determine their likely gender from their name, or use "they" if you cannot determine their likely gender for the following two bullet points, and after that write the specific observation you wish to share. Write only in the third person. Each topic should relate specifically to the individual's experiences or background - please focus on unusual things and broadly on why what the person has done in the past has impacted on what they do now. Do not use the same theme more than once. There might be a lot of repetition in experience, in which case, please summarize similar experience into a theme that can be easily understood an talked about. The response should be in a bulleted list format, and I want only the three points without additional explanations. Here is the data to use for your response: ${promptText} `;
    console.log("Completion prompt:", completionPrompt);

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: completionPrompt,
          },
        ],
        // max_tokens: 350,
        stream: true,
      });

      let responseContent = "";
      for await (const chunk of completion) {
        responseContent += chunk.choices[0].delta.content;
        console.log(chunk.choices[0].delta.content);

        // Emit the chunk to the frontend
        io.emit("responseChunk", {
          attendeeEmail: attendee.attendee_email,
          content: chunk.choices[0].delta.content,
        });
      }

      res.json({ content: responseContent });
    } catch (error) {
      console.error("Error while fetching completion from OpenAI:", error);
      return res.status(500).send("Error fetching data from OpenAI");
    }
  }
});

module.exports = router;

// router.post("/summarize-career-education", async (req, res) => {
//   const meetingData = req.body[0];
//   const attendees = meetingData.attendees;

//   const attendeeInfos = await fetchAllAttendeeInfos(attendees);

//   for (let i = 0; i < attendeeInfos.length; i++) {
//     const completionPrompt = createCompletionPrompt(
//       attendeeInfos[i],
//       attendees[i]
//     );
//     console.log("Completion prompt:", completionPrompt);
//     try {
//       const responseContent = await fetchCompletionFromOpenAI(completionPrompt);
//       res.json({ content: responseContent });
//     } catch (error) {
//       return res.status(500).send(error.message);
//     }
//   }
// });
