const { Worker } = require("bullmq");
const { redis } = require("../config/redis");
const { stopWatchGoogleCalendar } = require("../services/watchGoogleCalendar");

const worker = new Worker(
  "tokenExpiryQueue",
  async (job) => {
    const userId = job.data.userId;
    await stopWatchGoogleCalendar(userId);
  },
  {
    connection: redis,
  }
);

// Error handling for worker
worker.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed with error ${err.message}`);
});
