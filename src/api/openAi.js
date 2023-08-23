const OpenAI = require("openai");
const { OpenAiApiKey } = require("../config");

const openai = new OpenAI({
  apiKey: OpenAiApiKey,
});

module.exports = openai;
