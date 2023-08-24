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

  for (let i = 0; i < attendeeInfos.length; i++) {
    const attendeeInfo = attendeeInfos[i];
    const attendee = attendees[i]; // Assuming the ordering has remained consistent

    const promptText = convertToReadableText(
      attendeeInfo.experience,
      attendeeInfo.education,
      attendee
    );

    const completionPrompt = `Based on the education and career information provided, please list three rapport-building topics that could be used in conversation. Please be descriptive and use the format as if you are talking to someone as in "I noticed..." or "Your ..." and then the specific observation you wish to share. Each topic should relate specifically to the individual's experiences or background - please focus on unusual things and broadly on why what the person has done in the past has impacted on what they do now. There might be a lot of repetition in experience, in which case, please summarize similar experience into a theme that can be easily understood an talked about. The response should be in a bulleted list format, and I want only the three points without additional explanations. Here is the data to use for your response: ${promptText} `;
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
      }

      res.json({ content: responseContent });
    } catch (error) {
      console.error("Error while fetching completion from OpenAI:", error);
      // If you want to send an error response to the client:
      // return res.status(500).send("Error fetching data from OpenAI");
    }
  }
});

module.exports = router;

//  async function testChat() {
//     const completion = await openai.chat.completions.create({
//       model: "gpt-4",
//       messages: [
//         {
//           role: "system",
//           content:
//             "You are a helpful assistant. Please write 3 seperate bullet points, using a new paragraph for each one, that are the 3 things you like most about the world - be creative",
//         },
//       ],
//       max_tokens: 350,
//       stream: true,
//     });

//     let responseContent = "";
//     for await (const chunk of completion) {
//       responseContent += chunk.choices[0].delta.content;
//       console.log(chunk.choices[0].delta.content);
//     }
//     res.json({ content: responseContent });
//   }
//   testChat();
// });
