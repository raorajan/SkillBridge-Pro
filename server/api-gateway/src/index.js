require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const proxy = require("express-http-proxy");
const { createProxyMiddleware } = require("http-proxy-middleware");
const loggerUtils = require("./utils/logger.utils");
const logger = loggerUtils.logger;
const errorMiddleware = require("./middlewares/error.middleware");
const rabbitMQClient = require("./config/rabbitmq");

const app = express();
const server = http.createServer(app);
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
  ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : [
      "https://skillsbridge.raorajan.pro",
      "https://raorajan.github.io",
      "http://localhost:5180",
      "http://localhost:5173",
    ];

// In local / non-production environments, be permissive to avoid CORS pain.
// In production, restrict to the configured allow-list above.
const isDev = process.env.NODE_ENV !== "production";

const corsOptions = {
  origin: function (origin, callback) {
    if (isDev) {
      // Allow any origin in development (including undefined for tools like Postman)
      return callback(null, true);
    }

    // Production: allow requests with no origin (like mobile apps or curl) or from the allow-list
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
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

// Middleware - Configure helmet to work with CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// CRITICAL: Handle OPTIONS preflight requests FIRST, before CORS middleware
// This ensures preflight requests get proper CORS headers immediately
// Use a regex pattern that works with Express 5's path-to-regexp
app.options(/.*/, (req, res) => {
  const origin = req.headers.origin;
  
  // In development, allow any origin; in production, check allowedOrigins
  const shouldAllow = isDev || !origin || allowedOrigins.includes(origin);
  
  if (shouldAllow) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (isDev) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Cache-Control,Pragma,Accept,Accept-Language,Accept-Encoding');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  }
  
  res.status(200).end();
});

// Apply CORS middleware
app.use(cors(corsOptions));

// Additional middleware to ensure CORS headers are ALWAYS set on responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Set CORS headers on every response
  if (origin) {
    // In development, allow any origin
    if (isDev || allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } else if (isDev) {
    // In dev, allow requests without origin
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  // Always set these headers
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Cache-Control,Pragma,Accept,Accept-Language,Accept-Encoding');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type,Authorization');
  
  next();
});

// Request logging middleware - log ALL incoming requests EARLY (including OPTIONS)
// This must be before express.json to catch preflight requests
app.use((req, res, next) => {
  logger.info(`[${req.method}] ${req.originalUrl}`, {
    origin: req.headers.origin || 'no-origin',
    userAgent: req.headers['user-agent']?.substring(0, 50),
    authorization: req.headers.authorization ? 'Bearer ***' : 'none',
    query: Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : 'no-query'
  });
  next();
});

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
  
  // In development, allow any origin (same as CORS middleware)
  // In production, only allow origins from allowedOrigins list
  const shouldAllowOrigin = isDev || !origin || allowedOrigins.includes(origin);
  
  // ALWAYS set CORS headers if we have an origin and it should be allowed
  // This is critical - the browser needs these headers on EVERY response
  if (origin && shouldAllowOrigin) {
    // Origin is allowed - set CORS headers
    // NOTE: With credentials: true, we MUST use the specific origin, not '*'
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,PATCH,OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-Requested-With,Cache-Control,Pragma,Accept,Accept-Language,Accept-Encoding';
    headers['Access-Control-Expose-Headers'] = 'Content-Type,Authorization';
    // Set Vary header for proper caching
    const existingVary = headers['Vary'] || '';
    headers['Vary'] = existingVary ? `${existingVary}, Origin` : 'Origin';
  } else if (isDev && !origin) {
    // In development, if no origin (same-origin or Postman), allow it
    // But we can't use '*' with credentials: true, so only set if no credentials needed
    headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,PATCH,OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-Requested-With,Cache-Control,Pragma,Accept,Accept-Language,Accept-Encoding';
  }
  // If origin exists but is not allowed in production, don't set CORS headers (browser will block)
  
  return headers;
};

// Helper to send proxy errors with proper CORS headers so the browser
// doesn't treat them as generic "CORS errors" and hide the real problem.
const sendProxyErrorWithCors = (err, req, res, statusCode = 500, message = "Internal server error") => {
  const origin = req.headers.origin;

  if (isDev || (origin && allowedOrigins.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,PATCH,OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type,Authorization,X-Requested-With,Cache-Control,Pragma,Accept,Accept-Language,Accept-Encoding"
    );
    res.setHeader("Access-Control-Expose-Headers", "Content-Type,Authorization");
  }

  res
    .status(statusCode)
    .json({
      type: "error",
      status: statusCode,
      message,
      error: isDev ? err.message : undefined,
      data: null,
    });
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
      sendProxyErrorWithCors(err, req, res, 500, "Internal server error");
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
      logger.error(`Proxy error for ${req.method} ${req.originalUrl}:`, err);
      sendProxyErrorWithCors(err, req, res, 500, "Proxy error");
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

// WebSocket proxy for Socket.io connections
// Socket.io uses /socket.io/ path for its connections
app.use(
  "/socket.io",
  createProxyMiddleware({
    target: API_CHAT_URL,
    changeOrigin: true,
    ws: true, // Enable WebSocket proxying
    logLevel: "debug",
    onProxyReq: (proxyReq, req, res) => {
      // Forward all headers including Authorization for Socket.io handshake
      Object.keys(req.headers).forEach((key) => {
        proxyReq.setHeader(key, req.headers[key]);
      });
    },
    onError: (err, req, res) => {
      logger.error(`WebSocket proxy error for ${req.url}:`, err);
      if (!res.headersSent) {
        res.status(500).json({ message: "WebSocket proxy error", error: err.message });
      }
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
    server.listen(port, () => {
      console.log(`🚀 API Gateway running at http://localhost:${port}`);
      console.log(`📡 WebSocket proxy enabled for Socket.io connections`);
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
