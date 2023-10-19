import Redis from "ioredis";
const { REDIS_URL } = require("../config");
console.log("REDIS_URL:", REDIS_URL);

const redis = new Redis(REDIS_URL);

async function testRedis() {
  try {
    await redis.set("foo", "bar");
    let x = await redis.get("foo");
    console.log(x);
  } catch (error) {
    console.error("Error while testing Redis:", error);
  }
}

testRedis();

export default {
  redis,
};
