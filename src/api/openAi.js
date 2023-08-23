const openai = require("openai");
const { OpenAIApiKey } = require("../config");
const openAi = new openai.OpenAIApi(OpenAIApiKey);

module.exports = openAi;
