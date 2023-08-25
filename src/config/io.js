const socketIo = require("socket.io");

let io;

module.exports = {
  init: (httpServer) => {
    const corsOptions = {
      origin: "https://www.instantcollab.co", // IMPORTANT: Replace '*' with your client's URL in production
      methods: ["GET", "POST"],
    };

    io = socketIo(httpServer, { cors: corsOptions });

    io.on("connection", (socket) => {
      console.log("Client connected");

      socket.on("disconnect", () => {
        console.log("Client disconnected");
      });
    });

    return io;
  },

  getIo: () => {
    if (!io) {
      throw new Error("Socket.io not initialized!");
    }
    return io;
  },
};
