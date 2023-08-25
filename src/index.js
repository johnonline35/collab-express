// External Modules
const express = require("express");
const dotenv = require("dotenv");
const http = require("http");
const socketIoModule = require("./config/io");

// Initialize dotenv
dotenv.config();

// Initialize Express
const app = express();

// Log incoming request headers
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "PUT, POST, PATCH, DELETE, GET");
    return res.status(200).json({});
  }
  next();
});

// Middlewares
const corsMiddleware = require("./middleware/cors");
app.use(express.json());
app.use(corsMiddleware);

// Create an HTTP server and initialize socket.io
const server = http.createServer(app);
socketIoModule.init(server);

// Internal Modules
const calendarRoutes = require("./routes/calendarRoutes");
const openAiRoutes = require("./routes/openAiRoutes");

// Routes
app.use("/", calendarRoutes);
app.use("/", openAiRoutes);

// Start Server
const port = process.env.PORT || 3000;
const host = "0.0.0.0";
server.listen(port, host, () => {
  console.log(`App is listening on IP ${host} and port ${port}!`);
});
