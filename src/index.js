// External Modules
const express = require("express");
const dotenv = require("dotenv");

dotenv.config();
// Initialize Express
const app = express();

// Initialize dotenv

// Internal Modules
const corsMiddleware = require("./middleware/cors");
const calendarRoutes = require("./routes/calendarRoutes");
const { analyzeMeetings } = require("./services/meetingAnalysis");

// Middlewares
app.use(express.json());
app.use(corsMiddleware);

// Routes
app.use("/", calendarRoutes);

console.log("Index.js script started.");

// Error Handling Middleware
// ...

// Start Server
const port = process.env.PORT || 3000;
const host = "0.0.0.0";
app.listen(port, host, () => {
  console.log(`App is listening on IP ${host} and port ${port}!`);
});

analyzeMeetings("fb7b190c-27b4-4969-b591-5d2e9cd79dc9")
  .then((meetings) => {
    console.log(meetings);
  })
  .catch(console.error);
