// External Modules
const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");

// Initialize dotenv
dotenv.config();

// Initialize Express
const app = express();

// Middlewares
const corsMiddleware = require("./middleware/cors");
app.use(express.json());
app.use(corsMiddleware);
app.use(bodyParser.json());

// Internal Modules
const calendarRoutes = require("./routes/calendarRoutes");
const openAiRoutes = require("./routes/openAiRoutes");

// Routes
app.use("/", calendarRoutes);
app.use("/", openAiRoutes);

// Start Server
const port = process.env.PORT || 3000;
const host = "0.0.0.0";
app.listen(port, host, () => {
  console.log(`App is listening on IP ${host} and port ${port}!`);
});
