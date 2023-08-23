// External Modules
const express = require("express");
const dotenv = require("dotenv");

// Initialize dotenv
dotenv.config();

// Initialize Express
const app = express();

// Internal Modules
const corsMiddleware = require("./middleware/cors");
const calendarRoutes = require("./routes/calendarRoutes");
const openAiRoutes = require("./routes/openAiRoutes");

// Middlewares
app.use(express.json());
app.use(corsMiddleware);

// Routes
app.use("/", calendarRoutes);
app.use("/", openAiRoutes);

// Start Server
const port = process.env.PORT || 3000;
const host = "0.0.0.0";
app.listen(port, host, () => {
  console.log(`App is listening on IP ${host} and port ${port}!`);
});
