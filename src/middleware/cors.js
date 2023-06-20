const cors = require("cors");

const corsOptions = {
  origin: "https://www.instantcollab.co",
};

module.exports = cors(corsOptions);
