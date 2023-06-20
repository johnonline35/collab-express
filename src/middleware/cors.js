const cors = require("cors");

// Configure CORS middleware
const corsOptions = {
  origin: "*", // Allow all origins (for debugging purposes only)
  optionsSuccessStatus: 200,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: ["Content-Type", "Authorization"],
};

const corsMiddleware = cors(corsOptions);

module.exports = corsMiddleware;
