const cors = require("cors");

// Configure CORS middleware
const corsOptions = {
  origin: function (origin, callback) {
    if (
      origin === "https://www.instantcollab.co" ||
      origin === "https://www.instantcollab.co;"
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  optionsSuccessStatus: 200,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: ["Content-Type", "Authorization"],
};

const corsMiddleware = cors(corsOptions);

module.exports = corsMiddleware;
