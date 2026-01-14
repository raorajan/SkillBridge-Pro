require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const fileUpload = require("express-fileupload");
const errorMiddleware = require("shared/middleware/error.middleware");
const settingsRouter = require("./routes/settings.routes");
const logger = require("shared/utils/logger.utils");
const { initializeDatabase } = require("./config/database");

const app = express();
const PORT = process.env.PORT || 3003;

// 🔐 Core Middlewares - Configure helmet to work with CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_secret",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(
  fileUpload({
    useTempFiles: true,
  })
);

// 📦 Logging Middleware
app.use(logger.dev, logger.combined);

// 📂 Route Mounting
app.use("/api/v1/settings", settingsRouter);

// ⚠️ Error Middleware
app.use(errorMiddleware);

// 🚀 Start Server
const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () =>
      console.log(`🚀 Settings Service running on http://localhost:${PORT}`)
    );
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
