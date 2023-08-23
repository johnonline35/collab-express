const express = require("express");
const router = express.Router();
const supabase = require("../db/supabase");
const openAi = require("../api/openAi");

router.post("/summarize-career-education", async (req, res) => {
  console.log("Request received for /summarize-career-education"); // To confirm the endpoint is being hit

  try {
    // Use OpenAI to summarize the text
    console.log("About to call OpenAI with the prompt: ", completionPrompt);
    const completion = await openAi.createCompletion(
      {
        model: "text-davinci-004",
        prompt: completionPrompt,
        max_tokens: 350,
        stream: true,
      },
      {
        responseType: "stream",
      }
    );

    console.log("Received completion from OpenAI:", completion);

    res.json(completion);
  } catch (error) {
    console.error("Caught an error:", error); // This will give a detailed error message.
    if (error.response) {
      // If error response from OpenAI, print out the full error response
      console.error("OpenAI API error:", error.response.data);
    }
    res.status(500).send("Error summarizing data");
  }
});

module.exports = router;
