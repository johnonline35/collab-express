// External Modules
const express = require("express");
const dotenv = require("dotenv");

// Internal Modules
const corsMiddleware = require("../src/middleware/cors");
const calendarRoutes = require("../src/routes/calendarRoutes");

// Initialize dotenv
dotenv.config();

// Initialize Express
const app = express();

// Middlewares
app.use(express.json());
app.use(corsMiddleware);

// Routes
app.use("/", calendarRoutes);

// Error Handling Middleware
// ...

// Start Server
const port = process.env.PORT || 3000;
const host = "0.0.0.0";
app.listen(port, host, () => {
  console.log(`App is listening on IP ${host} and port ${port}!`);
});
