const { Queue } = require("bullmq");
const { redis } = require("../config/redis");

const tokenExpiryQueue = new Queue("tokenExpiryQueue", {
  connection: redis,
});

tokenExpiryQueue.on("completed", (job, result) => {
  console.log(`Job with ID ${job.id} has completed!`);
});

module.exports = tokenExpiryQueue;
