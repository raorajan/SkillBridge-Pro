require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const proxy = require("express-http-proxy");
const loggerUtils = require("./utils/logger.utils");
const logger = loggerUtils.logger;
const errorMiddleware = require("./middlewares/error.middleware");
const rabbitMQClient = require("./config/rabbitmq");

const app = express();
const port = Number(process.env.PORT || 3000);

// Load Swagger YAML files
const apiGatewaySwagger = YAML.load(
  path.join(__dirname, "swagger", "gateway.swagger.yaml")
);
const userSwagger = YAML.load(
  path.join(__dirname, "swagger", "user.swagger.yaml")
);
const projectSwagger = YAML.load(
  path.join(__dirname, "swagger", "project.swagger.yaml")
);
// Optional: settings swagger (if present)
let settingsSwagger = { servers: [], tags: [], paths: {}, components: {} };
try {
  settingsSwagger = YAML.load(
    path.join(__dirname, "swagger", "settings.swagger.yaml")
  );
} catch (e) {
  // settings swagger not present yet; proceed without it
}
// Optional: chat swagger (if present)
let chatSwagger = { servers: [], tags: [], paths: {}, components: {} };
try {
  chatSwagger = YAML.load(
    path.join(__dirname, "swagger", "chat.swagger.yaml")
  );
} catch (e) {
  // chat swagger not present yet; proceed without it
}

// Optional: tasks swagger (if present)
let tasksSwagger = { servers: [], tags: [], paths: {}, components: {} };
try {
  tasksSwagger = YAML.load(
    path.join(__dirname, "swagger", "tasks.swagger.yaml")
  );
} catch (e) {
  // tasks swagger not present yet; proceed without it
}

// Combine Swagger docs
const combinedSwagger = {
  openapi: "3.0.0",
  info: {
    title: "SkillBridge API Gateway",
    version: "1.0.0",
    description: "Unified API documentation for all microservices",
  },
  servers: [...apiGatewaySwagger.servers, ...userSwagger.servers, ...projectSwagger.servers, ...(settingsSwagger.servers || []), ...(chatSwagger.servers || []), ...(tasksSwagger.servers || [])],
  tags: [
    ...(apiGatewaySwagger.tags || []),
    ...(userSwagger.tags || []),
    ...(projectSwagger.tags || []),
    ...(settingsSwagger.tags || []),
    ...(chatSwagger.tags || []),
    ...(tasksSwagger.tags || [])
  ],
  paths: { 
    ...apiGatewaySwagger.paths, 
    ...userSwagger.paths, 
    ...projectSwagger.paths,
    ...(settingsSwagger.paths || {}),
    ...(chatSwagger.paths || {}),
    ...(tasksSwagger.paths || {})
  },
  components: {
    schemas: {
      ...(apiGatewaySwagger.components?.schemas || {}),
      ...(userSwagger.components?.schemas || {}),
      ...(projectSwagger.components?.schemas || {}),
      ...(settingsSwagger.components?.schemas || {}),
      ...(chatSwagger.components?.schemas || {}),
      ...(tasksSwagger.components?.schemas || {}),
    },
    securitySchemes: {
      ...(apiGatewaySwagger.components?.securitySchemes || {}),
      ...(userSwagger.components?.securitySchemes || {}),
      ...(projectSwagger.components?.securitySchemes || {}),
      ...(settingsSwagger.components?.securitySchemes || {}),
      ...(chatSwagger.components?.securitySchemes || {}),
      ...(tasksSwagger.components?.securitySchemes || {}),
    },
  },
  security: [{ bearerAuth: [] }],
};

// CORS Configuration
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'https://skillsbridge.raorajan.pro',
      'https://raorajan.github.io',
      'http://localhost:5180',
      'http://localhost:5173'
    ];

// Log allowed origins on startup
logger.info('CORS Allowed Origins:', allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests, Postman, or same-origin requests)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // Allow same-origin requests (when API gateway makes requests to itself, e.g., Swagger UI)
    const gatewayUrl = `http://localhost:${port}`;
    if (origin === gatewayUrl || origin === `http://localhost:${port}/` || origin === `http://127.0.0.1:${port}`) {
      callback(null, true);
      return;
    }
    
    // Check if origin is in allowed list (exact match)
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    
    // Origin not allowed
    logger.warn(`CORS blocked origin: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`);
    callback(new Error(`Not allowed by CORS: ${origin}`));
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

// Middleware - Configure helmet to work with CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// CORS middleware - must be before proxy routes
// This automatically handles both preflight OPTIONS requests and actual requests
app.use(cors(corsOptions));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Logging middleware
app.use(loggerUtils.dev, loggerUtils.combined);

// Static files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Proxy configuration
// Use localhost for local development, Docker service names for production
const isDocker = process.env.DOCKER_ENV === 'true' || process.env.NODE_ENV === 'production';
const API_USER_URL = process.env.API_USER_URL || (isDocker ? "http://user-service:3001" : "http://localhost:3001");
const API_PROJECT_URL = process.env.API_PROJECT_URL || (isDocker ? "http://project-service:3002" : "http://localhost:3002");
const API_SETTINGS_URL = process.env.API_SETTINGS_URL || (isDocker ? "http://settings-service:3003" : "http://localhost:3003");
const API_CHAT_URL = process.env.API_CHAT_URL || (isDocker ? "http://chat-service:3004" : "http://localhost:3004");

// Log proxy configuration
logger.info('Proxy Configuration:', {
  API_USER_URL,
  API_PROJECT_URL,
  API_SETTINGS_URL,
  API_CHAT_URL,
  isDocker,
  NODE_ENV: process.env.NODE_ENV
});

// Helper function to remove CORS headers from backend service responses and ensure gateway CORS headers are set
// The gateway handles CORS, so we don't want backend services to send their own CORS headers
const processCorsHeaders = (headers, userReq) => {
  const corsHeaders = [
    'access-control-allow-origin',
    'access-control-allow-methods',
    'access-control-allow-headers',
    'access-control-allow-credentials',
    'access-control-expose-headers',
    'access-control-max-age'
  ];
  
  // Remove backend CORS headers case-insensitively
  Object.keys(headers).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (corsHeaders.includes(lowerKey)) {
      delete headers[key];
    }
  });
  
  // Ensure gateway CORS headers are set (since proxy might overwrite them)
  const origin = userReq.headers.origin;
  if (origin) {
    // Allow same-origin requests from API gateway (for Swagger UI)
    const gatewayUrl = `http://localhost:${port}`;
    const isGatewayOrigin = origin === gatewayUrl || origin === `${gatewayUrl}/` || origin === `http://127.0.0.1:${port}`;
    
    if (isGatewayOrigin || allowedOrigins.includes(origin)) {
      // Origin is allowed - set CORS headers
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
      headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,PATCH,OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-Requested-With,Cache-Control,Pragma,Accept,Accept-Language,Accept-Encoding';
      headers['Access-Control-Expose-Headers'] = 'Content-Type,Authorization';
      // Set Vary header for proper caching
      const existingVary = headers['Vary'] || '';
      headers['Vary'] = existingVary ? `${existingVary}, Origin` : 'Origin';
    } else {
      // Origin not allowed - log for debugging
      logger.warn(`CORS: Origin ${origin} not in allowed list. Request: ${userReq.method} ${userReq.originalUrl}`);
    }
  }
  // If no origin header, it's likely a same-origin request, so CORS headers not needed
  
  return headers;
};

// Mount proxy at root `/` and forward full original path to user-service
app.use(
  "/api/v1/user",
  proxy(API_USER_URL, {
    proxyReqPathResolver: (req) => req.originalUrl,
    limit: "50mb",
    parseReqBody: true,
    proxyReqBodyDecorator: (bodyContent, srcReq) => bodyContent,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      // Forward all headers including Authorization
      proxyReqOpts.headers = { ...proxyReqOpts.headers, ...srcReq.headers };
      return proxyReqOpts;
    },
    userResHeaderDecorator: (headers, userReq, userRes, proxyReq, proxyRes) => {
      return processCorsHeaders(headers, userReq);
    },
    userResDecorator: async (proxyRes, proxyResData) => proxyResData.toString("utf8"),
    onError: (err, req, res) => {
      logger.error(`Proxy error for ${req.method} ${req.originalUrl}:`, err);
      res.status(500).json({ 
        type: 'error',
        status: 500,
        message: "Internal server error",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
        data: null
      });
    },
  })
);

app.use(
  "/api/v1/auth",
  proxy(API_USER_URL, {
    proxyReqPathResolver: (req) => req.originalUrl,
    limit: "50mb",
    parseReqBody: true,
    proxyReqBodyDecorator: (bodyContent, srcReq) => bodyContent,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      // Forward all headers including Authorization
      proxyReqOpts.headers = { ...proxyReqOpts.headers, ...srcReq.headers };
      return proxyReqOpts;
    },
    userResHeaderDecorator: (headers, userReq, userRes, proxyReq, proxyRes) => {
      return processCorsHeaders(headers, userReq);
    },
    userResDecorator: async (proxyRes, proxyResData) =>
      proxyResData.toString("utf8"),
    onError: (err, req, res) => {
      res.status(500).json({ message: "Proxy error", error: err.message });
    },
  })
);

app.use(
  "/api/v1/projects",
  proxy(API_PROJECT_URL, {
    proxyReqPathResolver: (req) => req.originalUrl,
    limit: "50mb",
    parseReqBody: true,
    proxyReqBodyDecorator: (bodyContent, srcReq) => bodyContent,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      // Forward all headers including Authorization
      proxyReqOpts.headers = { ...proxyReqOpts.headers, ...srcReq.headers };
      return proxyReqOpts;
    },
    userResHeaderDecorator: (headers, userReq, userRes, proxyReq, proxyRes) => {
      return processCorsHeaders(headers, userReq);
    },
    userResDecorator: async (proxyRes, proxyResData) =>
      proxyResData.toString("utf8"),
    onError: (err, req, res) => {
      res.status(500).json({ message: "Proxy error", error: err.message });
    },
  })
);

// Tasks routes (also handled by project-service)
app.use(
  "/api/v1/tasks",
  proxy(API_PROJECT_URL, {
    proxyReqPathResolver: (req) => req.originalUrl,
    limit: "50mb",
    parseReqBody: true,
    proxyReqBodyDecorator: (bodyContent, srcReq) => bodyContent,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      // Forward all headers including Authorization
      proxyReqOpts.headers = { ...proxyReqOpts.headers, ...srcReq.headers };
      return proxyReqOpts;
    },
    userResHeaderDecorator: (headers, userReq, userRes, proxyReq, proxyRes) => {
      return processCorsHeaders(headers, userReq);
    },
    userResDecorator: async (proxyRes, proxyResData) =>
      proxyResData.toString("utf8"),
    onError: (err, req, res) => {
      res.status(500).json({ message: "Proxy error", error: err.message });
    },
  })
);

app.use(
  "/api/v1/ai",
  proxy(API_PROJECT_URL, {
    proxyReqPathResolver: (req) => req.originalUrl,
    limit: "50mb",
    parseReqBody: true,
    proxyReqBodyDecorator: (bodyContent, srcReq) => bodyContent,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      // Forward all headers including Authorization
      proxyReqOpts.headers = { ...proxyReqOpts.headers, ...srcReq.headers };
      return proxyReqOpts;
    },
    userResHeaderDecorator: (headers, userReq, userRes, proxyReq, proxyRes) => {
      return processCorsHeaders(headers, userReq);
    },
    userResDecorator: async (proxyRes, proxyResData) =>
      proxyResData.toString("utf8"),
    onError: (err, req, res) => {
      res.status(500).json({ message: "Proxy error", error: err.message });
    },
  })
);

app.use(
  "/api/v1/ai-career",
  proxy(API_PROJECT_URL, {
    proxyReqPathResolver: (req) => req.originalUrl,
    limit: "50mb",
    parseReqBody: true,
    proxyReqBodyDecorator: (bodyContent, srcReq) => bodyContent,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      // Forward all headers including Authorization
      proxyReqOpts.headers = { ...proxyReqOpts.headers, ...srcReq.headers };
      return proxyReqOpts;
    },
    userResHeaderDecorator: (headers, userReq, userRes, proxyReq, proxyRes) => {
      return processCorsHeaders(headers, userReq);
    },
    userResDecorator: async (proxyRes, proxyResData) =>
      proxyResData.toString("utf8"),
    onError: (err, req, res) => {
      res.status(500).json({ message: "Proxy error", error: err.message });
    },
  })
);

app.use(
  "/api/v1/settings",
  proxy(API_SETTINGS_URL, {
    proxyReqPathResolver: (req) => req.originalUrl,
    limit: "50mb",
    parseReqBody: true,
    proxyReqBodyDecorator: (bodyContent, srcReq) => bodyContent,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      // Forward all headers including Authorization
      proxyReqOpts.headers = { ...proxyReqOpts.headers, ...srcReq.headers };
      return proxyReqOpts;
    },
    userResHeaderDecorator: (headers, userReq, userRes, proxyReq, proxyRes) => {
      return processCorsHeaders(headers, userReq);
    },
    userResDecorator: async (proxyRes, proxyResData) =>
      proxyResData.toString("utf8"),
    onError: (err, req, res) => {
      res.status(500).json({ message: "Proxy error", error: err.message });
    },
  })
);

app.use(
  "/api/v1/chat",
  proxy(API_CHAT_URL, {
    proxyReqPathResolver: (req) => req.originalUrl,
    limit: "50mb",
    parseReqBody: true,
    proxyReqBodyDecorator: (bodyContent, srcReq) => bodyContent,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      // Forward all headers including Authorization
      proxyReqOpts.headers = { ...proxyReqOpts.headers, ...srcReq.headers };
      return proxyReqOpts;
    },
    userResHeaderDecorator: (headers, userReq, userRes, proxyReq, proxyRes) => {
      return processCorsHeaders(headers, userReq);
    },
    userResDecorator: async (proxyRes, proxyResData) =>
      proxyResData.toString("utf8"),
    onError: (err, req, res) => {
      res.status(500).json({ message: "Proxy error", error: err.message });
    },
  })
);


// Error middleware must be after proxy
app.use(errorMiddleware);


// Serve Swagger JSON
app.get("/api-docs/swagger.json", (req, res) => {
  res.json(combinedSwagger);
});

// Swagger UI with automatic token capture
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(combinedSwagger, {
  customCss: `
    .swagger-ui .topbar { display: none; }
    .auth-status-bar {
      background: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: Arial, sans-serif;
    }
    .auth-status {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .auth-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #dc3545;
    }
    .auth-indicator.authenticated {
      background: #28a745;
    }
    .logout-btn {
      background: #dc3545;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    .logout-btn:hover {
      background: #c82333;
    }
  `,
  customSiteTitle: "SkillBridge API Documentation",
  swaggerOptions: {
    persistAuthorization: true, // Persist authorization across page refreshes
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
    onComplete: () => {
      // Define auth status functions
      function updateAuthStatus() {
        const token = localStorage.getItem('swagger-token');
        const indicator = document.getElementById('auth-indicator');
        const text = document.getElementById('auth-text');
        
        if (token) {
          if (indicator) indicator.className = 'auth-indicator authenticated';
          if (text) text.textContent = 'Authenticated';
        } else {
          if (indicator) indicator.className = 'auth-indicator';
          if (text) text.textContent = 'Not authenticated';
        }
      }
      
      function manualLogout() {
        localStorage.removeItem('swagger-token');
        updateAuthStatus();
        
        // Show logout message
        const logoutDiv = document.createElement('div');
        logoutDiv.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #ff6b6b;
          color: white;
          padding: 15px 20px;
          border-radius: 5px;
          z-index: 9999;
          font-family: Arial, sans-serif;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        logoutDiv.innerHTML = '🚪 Manual logout successful! Token cleared.';
        document.body.appendChild(logoutDiv);
        
        // Remove message after 3 seconds
        setTimeout(() => {
          if (logoutDiv.parentNode) {
            logoutDiv.parentNode.removeChild(logoutDiv);
          }
        }, 3000);
        
      }
      
      // Add custom auth status bar
      const authBar = document.createElement('div');
      authBar.className = 'auth-status-bar';
      authBar.innerHTML = `
        <div class="auth-status">
          <div class="auth-indicator" id="auth-indicator"></div>
          <span id="auth-text">Not authenticated</span>
        </div>
        <button class="logout-btn" onclick="manualLogout()">Logout</button>
      `;
      
      // Insert at the top of the page
      const swaggerContainer = document.querySelector('.swagger-ui');
      if (swaggerContainer) {
        swaggerContainer.insertBefore(authBar, swaggerContainer.firstChild);
      }
      
      // Update auth status
      updateAuthStatus();
      
      // Check auth status every 2 seconds
      setInterval(updateAuthStatus, 2000);
      
      // Define global functions
      window.updateAuthStatus = updateAuthStatus;
      window.manualLogout = manualLogout;
    },
    requestInterceptor: (req) => {
      // Auto-inject token if available
      const token = localStorage.getItem('swagger-token');
      if (token) {
        req.headers.Authorization = `Bearer ${token}`;
      }
      return req;
    },
    responseInterceptor: (res) => {
      // Auto-save token from login response
      if (res.url && res.url.includes('/api/v1/user/login') && res.status === 200) {
        try {
          const responseData = JSON.parse(res.body);
          if (responseData.token) {
            localStorage.setItem('swagger-token', responseData.token);
            setTimeout(() => {
              const successDiv = document.createElement('div');
              successDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4CAF50;
                color: white;
                padding: 15px 20px;
                border-radius: 5px;
                z-index: 9999;
                font-family: Arial, sans-serif;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              `;
              successDiv.innerHTML = '✅ Login successful! Token automatically saved. All API calls are now authorized.';
              document.body.appendChild(successDiv);
              
              // Remove message after 5 seconds
              setTimeout(() => {
                if (successDiv.parentNode) {
                  successDiv.parentNode.removeChild(successDiv);
                }
              }, 5000);
            }, 100);
          }
        } catch (e) {
          console.log('Could not parse login response');
        }
      }
      
      // Auto-clear token from logout response
      if (res.url && res.url.includes('/api/v1/user/logout') && res.status === 200) {
        try {
          const responseData = JSON.parse(res.body);
          if (responseData.success) {
            localStorage.removeItem('swagger-token');
            // Show logout message
            setTimeout(() => {
              const logoutDiv = document.createElement('div');
              logoutDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ff6b6b;
                color: white;
                padding: 15px 20px;
                border-radius: 5px;
                z-index: 9999;
                font-family: Arial, sans-serif;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              `;
              logoutDiv.innerHTML = '🚪 Logout successful! Token cleared. You are now logged out.';
              document.body.appendChild(logoutDiv);
              
              // Remove message after 5 seconds
              setTimeout(() => {
                if (logoutDiv.parentNode) {
                  logoutDiv.parentNode.removeChild(logoutDiv);
                }
              }, 5000);
            }, 100);
          }
        } catch (e) {
          console.log('Could not parse logout response');
        }
      }
      
      return res;
    }
  }
}));

// Start server
const startServer = async () => {
  try {
    await rabbitMQClient.connect();
    app.listen(port, () => {
      console.log(`🚀 API Gateway running at http://localhost:${port}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("🔌 Server shutting down...");
  process.exit();
});
process.on("SIGTERM", () => {
  console.log("💀 Server terminated.");
  process.exit();
});

startServer();
