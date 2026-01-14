require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const fileUpload = require("express-fileupload");
const errorMiddleware = require("shared/middleware/error.middleware");
const logger = require("shared/utils/logger.utils");
const { initializeDatabase } = require("./config/database");
const projectRouter = require("./routes/projects.routes");
const tasksRouter = require("./routes/tasks.routes");
const aiRouter = require("./routes/ai.routes");
const aiCareerRouter = require("./routes/ai-career.routes");

const app = express();
const PORT = process.env.PORT || 3002;

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
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/tasks", tasksRouter);
app.use("/api/v1/ai", aiRouter);
app.use("/api/v1/ai-career", aiCareerRouter);

// ⚠️ Error Middleware
app.use(errorMiddleware);

// 🚀 Start Server
const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () =>
      console.log(`🚀 Project Service running on http://localhost:${PORT}`)
    );
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
