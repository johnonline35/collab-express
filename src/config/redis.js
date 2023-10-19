import Redis from "ioredis";

const client = new Redis(
  "rediss://default:********@usw1-workable-pangolin-34300.upstash.io:34300"
);

await client.set("foo", "bar");

module.exports = {
  client,
};
