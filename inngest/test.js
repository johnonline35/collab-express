// const axios = require("axios");
// const inngest = require("./client");

// const fnA = inngest.createFunction(
//   { name: "Trigger Vercel Function" },
//   { event: "get/brandfetch" }, // This should match the event name that you're sending to Inngest
//   async ({ event, step }) => {
//     await step.run("Trigger Vercel Function", async () => {
//       const res = await axios.post(
//         "https://www.instantcollab.co/api/brandFetch",
//         event.data
//       );
//       // Handle the response...
//     });
//   }
// );

// module.exports = fnA;
