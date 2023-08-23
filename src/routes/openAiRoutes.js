const express = require("express");
const router = express.Router();
const supabase = require("../db/supabase");
const openAi = require("../api/openAi");

router.post("/summarize-career-education", async (req, res) => {
  try {
    // Fetch data from Supabase
    const careerData = await supabase.from("career_table").select("*");
    const educationData = await supabase.from("education_table").select("*");

    const prompt = convertToReadableText(careerData, educationData);
    const completionPrompt = `${prompt}\nBased on the education and career information provided, please list three rapport-building topics that could be used in conversation. Each topic should be a sentence or two and relate specifically to the individual's experiences or background.
`;

    // Use OpenAI to summarize the text
    const completion = await openAi.createCompletion(
      {
        model: "text-davinci-004",
        prompt: completionPrompt,
        max_tokens: 350,
        stream: true,
      },
      { responseType: "stream" }
    );

    res.json(completion);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error summarizing data");
  }
});

module.exports = router;
