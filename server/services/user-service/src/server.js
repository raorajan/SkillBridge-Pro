require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const fileUpload = require("express-fileupload");
const passport = require("passport");
const HttpException = require("shared/utils/HttpException.utils");
const errorMiddleware = require("shared/middleware/error.middleware");
const logger = require("shared/utils/logger.utils");
const { initializeDatabase } = require("./config/database");
const cloudinary = require("cloudinary").v2;

const userRouter = require("./routes/user.route");
const authRouter = require("./routes/auth.route");
const notificationsRouter = require("./routes/notifications.route");
const portfolioSyncRouter = require("./routes/portfolio-sync.route");
const billingRouter = require("./routes/billing.route");
require("./config/passport");

const app = express();
const PORT = process.env.PORT || 3001;

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

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
});

// 🧠 Passport Setup
app.use(passport.initialize());
app.use(passport.session());

// 📦 Logging Middleware
app.use(logger.dev, logger.combined);

// 📂 Route Mounting
app.use("/api/v1/user", userRouter);
app.use("/api/v1/user/notifications", notificationsRouter);
app.use("/api/v1/user/portfolio-sync", portfolioSyncRouter);
app.use("/api/v1/user/billing", billingRouter);
app.use("/api/v1/auth", authRouter);

// ❌ Handle Undefined Routes (Optional)
// app.all("*", (req, res, next) => {
//   next(new HttpException(404, "Endpoint Not Found"));
// });

// ⚠️ Error Middleware
app.use(errorMiddleware);

// 🚀 Start Server
const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () =>
      console.log(`🚀 User Service running on http://localhost:${PORT}`)
    );
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
