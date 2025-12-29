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

// CORS Configuration
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'https://skillsbridge.raorajan.pro',
      'https://raorajan.github.io',
      'http://localhost:5173'
    ];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "X-Requested-With",
    "Cache-Control",
    "Pragma",
    "Accept",
    "Accept-Language",
    "Accept-Encoding"
  ],
  exposedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
  preflightContinue: false,
};

// 🔐 Core Middlewares - Configure helmet to work with CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
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
