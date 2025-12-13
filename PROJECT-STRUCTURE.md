# SkillBridge Pro - Complete Project Structure & Configuration Guide

This document provides a comprehensive overview of the SkillBridge Pro project structure, Docker setup, and environment configuration for AI understanding and development reference.

---

## 📁 Project Structure

```
SkillBridge Pro/
│
├── client/                          # Frontend Application (React + Vite)
│   ├── Dockerfile                   # Frontend Docker configuration
│   ├── package.json                 # Frontend dependencies
│   ├── vite.config.js              # Vite build configuration
│   ├── public/                     # Static assets
│   │   ├── skillbridge_pro.svg
│   │   ├── skillbridge.svg
│   │   └── vite.svg
│   └── src/
│       ├── main.jsx                # React entry point
│       ├── App.jsx                 # Main App component
│       ├── index.css               # Global styles
│       ├── assets/                 # Static resources
│       │   ├── animation/          # Lottie animations (404.json, loader.json)
│       │   ├── fonts/              # Custom fonts (Instrument Sans, Playfair Display, Icons)
│       │   ├── icons/              # SVG icons (36 icons)
│       │   └── images/             # Images (logos, backgrounds, etc.)
│       ├── components/             # Reusable UI components
│       │   ├── AuthInitializer.jsx
│       │   ├── ErrorBoundary.jsx
│       │   ├── Badge/
│       │   ├── Breadcrumb/
│       │   ├── Button/
│       │   ├── Footer/
│       │   ├── Header/
│       │   ├── Input/
│       │   ├── Layout/
│       │   ├── Loader/
│       │   ├── Modal/
│       │   ├── Navigation/
│       │   ├── Profile/            # Profile-related components (10 files)
│       │   └── utils/              # Utility functions
│       ├── modules/                # Feature modules (Redux-based)
│       │   ├── aicareer/           # AI Career features
│       │   │   ├── components/
│       │   │   ├── container/
│       │   │   └── slice/          # Redux slice
│       │   ├── authentication/     # Auth module
│       │   ├── billingsubscription/# Billing & subscriptions
│       │   ├── chat/               # Chat functionality
│       │   ├── dashboard/          # Dashboard module
│       │   ├── gamification/       # Gamification features
│       │   ├── home/               # Home page module
│       │   ├── notifications/      # Notifications
│       │   ├── portfolioSync/      # Portfolio sync (GitHub, LinkedIn, etc.)
│       │   ├── profile/            # User profile
│       │   ├── project/            # Project management
│       │   └── settings/           # User settings
│       ├── redux/                  # Redux state management
│       │   ├── reducers/
│       │   └── store/              # Redux store configuration
│       ├── router/                 # React Router configuration
│       │   ├── index.jsx           # Router setup
│       │   ├── PrivateRoute.jsx    # Protected routes
│       │   ├── Error404.jsx
│       │   └── Unauthorized.jsx
│       ├── services/               # API & external services
│       │   ├── api/
│       │   │   └── index.js        # Axios API client
│       │   ├── constants/
│       │   ├── socket.js           # Socket.io client
│       │   ├── sw/                 # Service worker
│       │   └── utils/
│       └── style/                  # CSS files
│           ├── icons.css
│           ├── index.css
│           ├── main.css
│           └── ui-controls.css
│
├── server/                         # Backend Microservices
│   ├── package.json                # Root package.json (orchestration scripts)
│   ├── docker-compose.yml          # Server-only docker-compose (optional)
│   │
│   ├── api-gateway/                # API Gateway Service (Port 3000)
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.js            # Express server entry point
│   │       ├── config/
│   │       │   ├── proxy.js        # Proxy configuration
│   │       │   ├── rabbitmq.js     # RabbitMQ config (optional)
│   │       │   └── redis.js        # Redis config (optional)
│   │       ├── middlewares/
│   │       │   ├── cache.js        # Caching middleware
│   │       │   └── error.middleware.js
│   │       ├── services/           # Gateway services
│   │       ├── swagger/            # API documentation
│   │       │   ├── gateway.swagger.yaml
│   │       │   ├── user.swagger.yaml
│   │       │   ├── project.swagger.yaml
│   │       │   ├── settings.swagger.yaml
│   │       │   ├── chat.swagger.yaml
│   │       │   └── tasks.swagger.yaml
│   │       └── utils/
│   │           ├── HttpException.utils.js
│   │           └── logger.utils.js
│   │
│   ├── services/                   # Microservices
│   │   ├── user-service/           # User Service (Port 3001)
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   ├── drizzle.config.js   # Drizzle ORM config
│   │   │   └── src/
│   │   │       ├── server.js       # Service entry point
│   │   │       ├── config/
│   │   │       │   └── database.js # PostgreSQL connection
│   │   │       ├── controllers/    # Request handlers (4 controllers)
│   │   │       ├── models/         # Drizzle ORM models (6 models)
│   │   │       ├── routes/         # Express routes (5 route files)
│   │   │       ├── services/       # Business logic
│   │   │       └── db/
│   │   │           └── migrations/ # Database migrations
│   │   │
│   │   ├── project-service/        # Project Service (Port 3002)
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   ├── drizzle.config.js
│   │   │   └── src/
│   │   │       ├── server.js
│   │   │       ├── config/
│   │   │       │   └── database.js
│   │   │       ├── controllers/    # 4 controllers
│   │   │       ├── models/         # 24 models (projects, applications, etc.)
│   │   │       ├── routes/         # 4 route files
│   │   │       ├── middlewares/    # Auth & error handling
│   │   │       ├── services/       # Business logic
│   │   │       ├── utils/          # Utilities (4 files)
│   │   │       └── db/
│   │   │           └── migrations/ # 4 migration files
│   │   │
│   │   ├── settings-service/       # Settings Service (Port 3003)
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   ├── drizzle.config.js
│   │   │   └── src/
│   │   │       ├── server.js
│   │   │       ├── config/
│   │   │       │   └── database.js
│   │   │       ├── controllers/    # 1 controller
│   │   │       ├── models/         # 7 models (notification, privacy, integrations)
│   │   │       ├── routes/         # 1 route file
│   │   │       └── db/
│   │   │           └── migrations/ # 2 migration files
│   │   │
│   │   ├── chat-service/           # Chat Service (Port 3004)
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   ├── drizzle.config.js
│   │   │   └── src/
│   │   │       ├── server.js       # Express + Socket.io server
│   │   │       ├── config/
│   │   │       │   └── database.js
│   │   │       ├── controllers/    # Chat controllers
│   │   │       ├── models/         # 5 models (conversations, messages)
│   │   │       ├── routes/         # REST API routes
│   │   │       ├── socket/         # Socket.io handlers
│   │   │       │   ├── socket.auth.js
│   │   │       │   └── socket.handlers.js
│   │   │       └── db/
│   │   │           └── migrations/ # 2 migration files
│   │   │
│   │   ├── ai-service/             # AI Service (Placeholder)
│   │   └── ml-service/             # ML Service (Placeholder)
│   │
│   ├── shared/                     # Shared utilities across services
│   │   ├── package.json
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js       # JWT authentication
│   │   │   ├── roleAuth.middleware.js   # Role-based access
│   │   │   ├── error.middleware.js      # Error handling
│   │   │   ├── awaitHandlerFactory.middleware.js
│   │   │   └── controllerLogger.middleware.js
│   │   ├── utils/
│   │   │   ├── errorHandler.js
│   │   │   ├── HttpException.utils.js
│   │   │   ├── logger.utils.js
│   │   │   ├── sendEmail.js          # Email utility
│   │   │   ├── supabase.utils.js     # Supabase client
│   │   │   └── uploadFile.utils.js   # File upload (Cloudinary)
│   │   └── migration/              # Database migration utilities
│   │       ├── MigrationManager.js
│   │       ├── migrate.js
│   │       ├── rollback.js
│   │       └── status.js
│   │
│   └── scripts/                    # Database management scripts
│       ├── seed-database.js        # Seed database with data
│       ├── seed-empty-tables.js    # Seed empty tables
│       ├── reset-database.js       # Reset database
│       ├── reset-all-tables.js     # Drop and recreate tables
│       ├── drop-all-tables.js      # Drop all tables
│       ├── create-enums.js         # Create PostgreSQL enums
│       ├── create-endorsements-table.js
│       ├── check-empty-tables.js
│       ├── reset-all-table-checks.js
│       └── restore-from-backup.js
│
├── docker-compose.yml              # Main Docker Compose (All Services)
└── README.md                       # Project README

```

---

## 🐳 Docker Configuration

### Root `docker-compose.yml`

**Services:**
1. **backend** (API Gateway) - Port 3000
2. **user-service** - Port 3001
3. **project-service** - Port 3002
4. **settings-service** - Port 3003
5. **chat-service** - Port 3004
6. **frontend** - Port 5173

**Network:** `skillbridge-network` (bridge driver)

**Dependencies:**
- `backend` depends on all microservices
- `frontend` depends on `backend`

---

### Dockerfiles

#### 1. Frontend Dockerfile (`client/Dockerfile`)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
```

**Characteristics:**
- Uses development server (not production build)
- Runs Vite dev server with HMR
- Port: 5173

---

#### 2. API Gateway Dockerfile (`server/api-gateway/Dockerfile`)

```dockerfile
FROM node:18-alpine
WORKDIR /app

# Copy shared package first (dependency)
COPY shared/package*.json ./shared/
COPY shared/ ./shared/

# Copy api-gateway package files
COPY api-gateway/package*.json ./

# Install shared dependencies first
WORKDIR /app/shared
RUN npm install

# Install api-gateway dependencies
WORKDIR /app
RUN npm install

# Copy api-gateway application files
COPY api-gateway/ ./

EXPOSE 3000
CMD ["node", "src/index.js"]
```

**Characteristics:**
- Build context: `./server`
- Installs shared package first (dependency)
- Entry point: `src/index.js`
- Port: 3000

---

#### 3. User Service Dockerfile (`server/services/user-service/Dockerfile`)

```dockerfile
FROM node:18-alpine
WORKDIR /app

# Copy shared package first
COPY shared/package*.json ./shared/
COPY shared/ ./shared/

# Copy user-service package files
COPY services/user-service/package*.json ./

# Install shared dependencies first
WORKDIR /app/shared
RUN npm install

# Install user-service dependencies
WORKDIR /app
RUN npm install

# Copy user-service application files
COPY services/user-service/ ./

EXPOSE 3001
CMD ["node", "src/server.js"]
```

**Characteristics:**
- Build context: `./server`
- Entry point: `src/server.js`
- Port: 3001

---

#### 4. Project Service Dockerfile (`server/services/project-service/Dockerfile`)

**Same structure as user-service:**
- Build context: `./server`
- Entry point: `src/server.js`
- Port: 3002

---

#### 5. Settings Service Dockerfile (`server/services/settings-service/Dockerfile`)

**Same structure as user-service:**
- Build context: `./server`
- Entry point: `src/server.js`
- Port: 3003

---

#### 6. Chat Service Dockerfile (`server/services/chat-service/Dockerfile`)

**Same structure as user-service:**
- Build context: `./server`
- Entry point: `src/server.js`
- Port: 3004
- Includes Socket.io for real-time messaging

---

## 🔐 Environment Variables (.env)

Create a `.env` file in the project root. All services read from this file via `docker-compose.yml`.

### Core Configuration

```env
# Application Environment
NODE_ENV=production
# Options: development, production

# CORS Configuration
CORS_ALLOWED_ORIGINS=https://skillsbridge.raorajan.pro,http://localhost:5173
```

---

### Database Configuration (PostgreSQL)

```env
# PostgreSQL Database
DB_HOST=your-postgres-host
DB_PORT=5432
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=skillbridge_db
DB_SSL=true
# Options: true (for cloud/remote), false (for local)
```

**Note:** All microservices (user-service, project-service, settings-service, chat-service) use the same PostgreSQL database.

---

### JWT & Session Configuration

```env
# JWT Secret (used by all services)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
# Format: number + unit (e.g., "7d", "24h", "3600s")

# Session Secret (used by user-service, chat-service)
SESSION_SECRET=your-super-secret-session-key-change-in-production
```

---

### API Gateway Configuration

```env
# API Gateway URLs
BACKEND_URL=https://skillsbridgeapi.raorajan.pro
FRONTEND_URL=https://skillsbridge.raorajan.pro
CLIENT_URL=https://skillsbridge.raorajan.pro
API_GATEWAY_URL=https://skillsbridgeapi.raorajan.pro
API_GATEWAY_BASE_URL=https://skillsbridgeapi.raorajan.pro

# Internal Service URLs (Docker network)
API_USER_URL=http://user-service:3001
API_PROJECT_URL=http://project-service:3002
API_SETTINGS_URL=http://settings-service:3003
API_CHAT_URL=http://chat-service:3004

# MongoDB (if used for any service)
MONGODB_URL=mongodb://localhost:27017/skillbridge
```

---

### OAuth Configuration (Google, GitHub, LinkedIn)

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://skillsbridgeapi.raorajan.pro/api/v1/auth/google/callback

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=https://skillsbridgeapi.raorajan.pro/api/v1/auth/github/callback
GITHUB_API_BASE_URL=https://api.github.com
GITHUB_WEB_BASE_URL=https://github.com

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
LINKEDIN_CALLBACK_URL=https://skillsbridgeapi.raorajan.pro/api/v1/auth/linkedin/callback
```

---

### Supabase Configuration

```env
# Supabase (Database & Storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_PRIVATE_ROLE_KEY=your-supabase-service-private-key
SUPABASE_SERVICE_PUBLIC_ROLE_KEY=your-supabase-service-public-key
```

---

### Email Configuration (SMTP)

```env
# Email Service (Nodemailer)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# SMTP Configuration (Alternative)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SERVICE=gmail
SMTP_MAIL=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Email URLs
VERIFY_EMAIL_URL=https://skillsbridge.raorajan.pro/verify-email
RESET_PASSWORD_URL=https://skillsbridge.raorajan.pro/reset-password
```

---

### Cloudinary Configuration (File Uploads)

```env
# Cloudinary (Image/File Storage)
CLOUDINARY_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_SECRET_KEY=your-cloudinary-secret-key
```

---

### Frontend Environment Variables (Vite)

**Note:** Vite requires `VITE_` prefix for client-side variables.

```env
# Frontend Environment Variables
VITE_API_URL=https://skillsbridgeapi.raorajan.pro/
VITE_APP_API_URL=https://skillsbridgeapi.raorajan.pro/
VITE_FRONTEND_URL=https://skillsbridge.raorajan.pro/
VITE_CHAT_SERVICE_URL=https://skillsbridgeapi.raorajan.pro
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
```

**These are set in `docker-compose.yml` under the `frontend` service.**

---

### Additional Configuration

```env
# Portfolio Sync URLs
PORTFOLIO_SYNC_REDIRECT_URL=https://skillsbridge.raorajan.pro/portfolio-sync

# StackOverflow API (if used)
STACKOVERFLOW_API_BASE_URL=https://api.stackexchange.com/2.3
STACKOVERFLOW_SITE=stackoverflow
```

---

## 🚀 Docker Compose Service Ports

| Service | Container Port | Host Port | Internal URL (Docker Network) |
|---------|---------------|-----------|-------------------------------|
| API Gateway | 3000 | 3000 | `http://backend:3000` |
| User Service | 3001 | 3001 | `http://user-service:3001` |
| Project Service | 3002 | 3002 | `http://project-service:3002` |
| Settings Service | 3003 | 3003 | `http://settings-service:3003` |
| Chat Service | 3004 | 3004 | `http://chat-service:3004` |
| Frontend | 5173 | 5173 | `http://frontend:5173` |

---

## 📦 Technology Stack

### Frontend
- **React 19** - UI library
- **Vite 7** - Build tool & dev server
- **Redux Toolkit** - State management
- **React Router** - Routing
- **Axios** - HTTP client
- **Socket.io-client** - WebSocket client
- **Tailwind CSS** - Styling
- **DaisyUI** - UI components
- **Supabase JS** - Supabase client

### Backend
- **Node.js 18** - Runtime
- **Express 5** - Web framework
- **PostgreSQL** - Primary database (via Drizzle ORM)
- **Drizzle ORM** - Database ORM
- **Socket.io** - WebSocket server (chat-service)
- **JWT** - Authentication
- **Nodemailer** - Email service
- **Cloudinary** - File uploads
- **Winston** - Logging

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Orchestration
- **Alpine Linux** - Base Docker image

---

## 🔄 Service Communication Flow

```
Frontend (Port 5173)
    ↓ HTTP Requests
API Gateway (Port 3000)
    ↓ Proxies to internal services
    ├──→ User Service (Port 3001)
    ├──→ Project Service (Port 3002)
    ├──→ Settings Service (Port 3003)
    └──→ Chat Service (Port 3004)
         └──→ WebSocket (Socket.io)
```

**All services communicate via Docker network `skillbridge-network`.**

---

## 📝 Database Schema

All services use **PostgreSQL** with **Drizzle ORM**:
- **User Service**: Users, profiles, skills, endorsements, portfolios
- **Project Service**: Projects, applications, invitations, collaborations
- **Settings Service**: User preferences, notifications, privacy, integrations
- **Chat Service**: Conversations, messages, participants

**Migration Management:**
- Migrations stored in each service's `src/db/migrations/`
- Run migrations via scripts in `server/scripts/`
- Each service has its own `drizzle.config.js`

---

## 🔧 Development Workflow

### Local Development (Without Docker)

```bash
# Backend
cd server
npm run install:all
npm run db:migrate
npm run db:seed
npm start

# Frontend
cd client
npm install
npm run dev
```

### Docker Development

```bash
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## 📌 Key Files Reference

### Configuration Files
- `docker-compose.yml` - Main orchestration
- `client/vite.config.js` - Frontend build config
- `server/package.json` - Backend scripts & dependencies
- `client/package.json` - Frontend dependencies

### Entry Points
- `client/src/main.jsx` - Frontend entry
- `server/api-gateway/src/index.js` - API Gateway entry
- `server/services/*/src/server.js` - Service entries

### Shared Resources
- `server/shared/` - Common utilities, middleware, models
- All services depend on `shared` package

---

## 🎯 API Endpoints Structure

### API Gateway Routes (Port 3000)
- `/api/v1/user/*` → Proxies to User Service
- `/api/v1/auth/*` → Proxies to User Service
- `/api/v1/project/*` → Proxies to Project Service
- `/api/v1/settings/*` → Proxies to Settings Service
- `/api/v1/chat/*` → Proxies to Chat Service
- `/api-docs` → Swagger documentation

### Service-Specific Routes
- **User Service**: Authentication, user management, profiles
- **Project Service**: Projects, applications, collaborations
- **Settings Service**: User preferences, notifications
- **Chat Service**: Conversations, real-time messaging (REST + WebSocket)

---

This documentation serves as a complete reference for understanding the SkillBridge Pro project architecture, Docker setup, and environment configuration.

