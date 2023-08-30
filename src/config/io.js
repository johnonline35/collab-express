const socketIo = require("socket.io");

let io;
let userSocketMap = {};

function initializeSocketConnection(httpServer) {
  const corsOptions = {
    origin: "*", // IMPORTANT: Replace '*' in production
    methods: ["GET", "POST"],
  };

  io = socketIo(httpServer, { cors: corsOptions });

  io.on("connection", (socket) => {
    console.log("Client connected");

    // Register user's socket based on their userId
    socket.on("registerUser", (userId) => {
      userSocketMap[userId] = socket;
      console.log(`User ${userId} registered`);
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    socket.on("disconnect", () => {
      // Remove user's socket from userSocketMap on disconnect
      for (let userId in userSocketMap) {
        if (userSocketMap[userId] === socket) {
          delete userSocketMap[userId];
          console.log(`User ${userId} disconnected`);
          break;
        }
      }
    });
  });
}

module.exports = {
  init: (httpServer) => {
    initializeSocketConnection(httpServer);
    return io;
  },

  getIo: () => {
    if (!io) {
      throw new Error("Socket.io not initialized!");
    }
    return io;
  },

  // Optionally, if you need access to the user-socket map elsewhere:
  getUserSocketMap: () => userSocketMap,
};
