const express = require("express");
const router = express.Router();
const supabase = require("../db/supabase");
const openai = require("../api/openAi");

router.post("/summarize-career-education", async (req, res) => {
  console.log("Request received for /summarize-career-education"); // To confirm the endpoint is being hit

  //   try {
  //     // Fetch data from Supabase
  //     // const careerData = await supabase.from("career_table").select("*");
  //     // const educationData = await supabase.from("education_table").select("*");

  //     // const prompt = convertToReadableText(careerData, educationData);
  //     //

  async function testChat() {
    const chatCompletion = await openai.chat.completions.create({
      messages: [{ role: "user", content: "Say this is a test" }],
      model: "gpt-3.5-turbo",
    });

    console.log(chatCompletion);
  }

  testChat();
  // const completionPrompt = `Based on the education and career information provided: went to stanford, studied medicine, is a billionare, please list three rapport-building topics that could be used in conversation. Each topic should be a sentence or two and relate specifically to the individual's experiences or background.
  // `;

  // //     // Use OpenAI to summarize the text
  // console.log("About to call OpenAI with the prompt: ", completionPrompt);
  // const completion = await openai.chat.completions.create(
  //   {
  //     model: "text-davinci-004",
  //     prompt: completionPrompt,
  //     max_tokens: 350,
  //     stream: true,
  //   },
  //   {
  //     responseType: "stream",
  //   }
  // );

  // console.log("Received completion from OpenAI:", completion);

  //     res.json(completion);
  //   } catch (error) {
  //     console.error("Caught an error:", error); // This will give a detailed error message.
  //     if (error.response) {
  //       // If error response from OpenAI, print out the full error response
  //       console.error("OpenAI API error:", error.response.data);
  //     }
  //     res.status(500).send("Error summarizing data");
  //   }
});

module.exports = router;
