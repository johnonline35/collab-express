const Redis = require("ioredis");
const { REDIS_URL } = require("../config");

const redis = new Redis(REDIS_URL);

module.exports = {
  redis,
};
