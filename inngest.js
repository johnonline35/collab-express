const { Inngest } = require("inngest");
const axios = require("axios");

const inngest = new Inngest({ name: "Test" });

const fn = inngest.createFunction(
  { name: "Trigger Vercel Function" },
  { event: "get/brandfetch" }, // This should match the event name that you're sending to Inngest
  async ({ event, step }) => {
    await step.run("Trigger Vercel Function", async () => {
      const res = await axios.post(
        "https://www.instantcollab.co/api/brandFetch",
        event.data
      );
      // Handle the response...
    });
  }
);

module.exports = fn;
