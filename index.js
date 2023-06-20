// require("dotenv").config();
// const express = require("express");
// const apiClient = require("./apiClient");
// const cors = require("cors");

// const app = express();
// app.use(express.json()); // Middleware to parse JSON bodies
// app.use(cors());

// // app.use(
// //   cors({
// //     origin: "https://www.instantcollab.co",
// //   })
// // );

// app.post("/", async function (req, res) {
//   const { userId } = req.body;
//   console.log(userId); // Log the userId sent from your getMeetings function
//   const meetings = await apiClient.getGoogleCal(userId); // Pass userId to your getGoogleCal function
//   res.send("Received your request!");
// });

// const port = process.env.PORT || 3000;
// app.listen(port, "0.0.0.0", function () {
//   console.log(`App is listening on IP 0.0.0.0 and port ${port}!`);
// });
