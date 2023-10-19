import Redis from "ioredis";
const { REDIS_URL } = require("../config");

const client = new Redis(REDIS_URL);

await client.set("foo", "bar");
let x = await client.get("foo");
console.log(x);

export default {
  client,
};
