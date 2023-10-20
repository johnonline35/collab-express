import Redis from "ioredis";
const { REDIS_URL } = require("../config");
console.log("Loading Redis setup...");
console.log("REDIS_URL:", REDIS_URL);

const redis = new Redis(REDIS_URL);

redis.set("foo", "bar", (err, result) => {
  if (err) console.error("Set Error:", err);
  else {
    redis.get("foo", (err, value) => {
      if (err) console.error("Get Error:", err);
      else console.log(value); // should print "bar"
    });
  }
});

export default {
  redis,
};
