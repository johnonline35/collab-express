// External Modules
const express = require("express");
const dotenv = require("dotenv");
const http = require("http");
const socketIo = require("socket.io");

// Initialize dotenv
dotenv.config();

// Initialize Express
const app = express();

// Middlewares
const corsMiddleware = require("./middleware/cors");
app.use(express.json());
app.use(corsMiddleware);

// Internal Modules
const calendarRoutes = require("./routes/calendarRoutes");
const openAiRoutes = require("./routes/openAiRoutes");

// Routes
app.use("/", calendarRoutes);
app.use("/", openAiRoutes);

// Create an HTTP server and wrap the Express app
const server = http.createServer(app);
const io = socketIo(server);

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Start Server
const port = process.env.PORT || 3000;
const host = "0.0.0.0";
server.listen(port, host, () => {
  // Note: Changed app.listen to server.listen
  console.log(`App is listening on IP ${host} and port ${port}!`);
});
