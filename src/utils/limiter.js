const Bottleneck = require("bottleneck");

const limiter = new Bottleneck({
  minTime: 100, // Adjust this value based on your rate limits
});

module.exports = limiter;
