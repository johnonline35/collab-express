const OpenAI = require("openai");
const { OpenAiApiKey } = require("../config");
// const openAi = new openai.OpenAIApi(OpenAIApiKey);

const openai = new OpenAI({
  apiKey: OpenAiApiKey,
});

module.exports = openai;
