const OpenAI = require("openai");
const { OpenAiApiKey } = require("../config");

const openai = new OpenAI({
  apiKey: OpenAiApiKey,
});

async function fetchCompletionFromOpenAI(prompt) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "system", content: prompt }],
      stream: true,
    });

    let responseContent = "";
    for await (const chunk of completion) {
      responseContent += chunk.choices[0].delta.content;
    }

    return responseContent;
  } catch (error) {
    console.error("Error while fetching completion from OpenAI:", error);
    throw new Error("Error fetching data from OpenAI");
  }
}
module.exports = {
  openai,
  fetchCompletionFromOpenAI,
};
