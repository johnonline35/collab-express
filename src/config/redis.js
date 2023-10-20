const Redis = require("ioredis");
const { REDIS_URL } = require("../config");

const redis = new Redis(REDIS_URL);

module.exports = {
  redis,
};

// redis.set("foo", "bar", (err, result) => {
//   if (err) console.error("Set Error:", err);
//   else {
//     redis.get("foo", (err, value) => {
//       if (err) console.error("Get Error:", err);
//       else console.log(value);
//     });
//   }
// });
