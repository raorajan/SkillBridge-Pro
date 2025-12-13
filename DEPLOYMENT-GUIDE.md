# SkillBridge Pro - Deployment Guide

## ✅ Setup Complete!

All Docker files and scripts have been created and optimized. Here's what's been implemented:

## 📁 Files Created/Updated

### Docker Configuration
- ✅ `docker-compose.yml` - Simplified with better defaults and error handling
- ✅ `server/shared/Dockerfile` - Shared dependencies builder
- ✅ `server/api-gateway/Dockerfile` - API Gateway with improved health checks
- ✅ `server/services/user-service/Dockerfile` - Updated with error handling
- ✅ `server/services/project-service/Dockerfile` - Updated with error handling
- ✅ `server/services/settings-service/Dockerfile` - Updated with error handling
- ✅ `server/services/chat-service/Dockerfile` - Updated with error handling
- ✅ `client/Dockerfile` - Production build with serve

### Scripts
- ✅ `scripts/deploy.sh` - Full deployment automation
- ✅ `scripts/start.sh` - Start all services
- ✅ `scripts/stop.sh` - Stop all services
- ✅ `scripts/logs.sh` - View logs (all or specific service)
- ✅ `scripts/restart-service.sh` - Restart a specific service
- ✅ `scripts/update.sh` - Update and rebuild
- ✅ `scripts/init-db.sql` - Database initialization

## 🚀 Quick Start

### 1. Ensure .env File Exists

Make sure you have a `.env` file in the project root with all required variables. Key variables:

```env
# Database (for local Docker PostgreSQL)
DB_NAME=skillbridge_db
DB_USER=skillbridge_user
DB_PASSWORD=your_secure_password

# Or use your Neon PostgreSQL
DB_HOST=ep-odd-mouse-a1t2hqnl-pooler.ap-southeast-1.aws.neon.tech
DB_PORT=5432
DB_USER=neondb_owner
DB_PASSWORD=npg_YrbNaX71AvtO
DB_NAME=SkillBridge_Dev
DB_SSL=true

# Auth
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret

# URLs
BACKEND_URL=https://skillsbridgeapi.raorajan.pro
FRONTEND_URL=https://skillsbridge.raorajan.pro
CLIENT_URL=https://skillsbridge.raorajan.pro
API_GATEWAY_URL=https://skillsbridgeapi.raorajan.pro
API_GATEWAY_BASE_URL=https://skillsbridgeapi.raorajan.pro
CORS_ALLOWED_ORIGINS=https://skillsbridge.raorajan.pro,http://localhost:5173

# OAuth, Supabase, Cloudinary, etc.
# ... (see your original .env template)
```

### 2. Deploy

```bash
cd ~/SkillBridge-Pro
bash scripts/deploy.sh
```

This will:
1. Create necessary directories
2. Stop existing services
3. Clean up old Docker images
4. Build shared dependencies
5. Build and start all services
6. Wait for health checks
7. Display status and access information

### 3. Manual Deployment (Alternative)

If you prefer step-by-step:

```bash
# Build shared dependencies first
docker build -t skillsbridge-shared:latest -f server/shared/Dockerfile ./server

# Start all services
docker-compose up --build -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

## 🔧 Management Commands

### Start Services
```bash
bash scripts/start.sh
```

### Stop Services
```bash
bash scripts/stop.sh
```

### View Logs
```bash
# All services
bash scripts/logs.sh

# Specific service
bash scripts/logs.sh user-service
bash scripts/logs.sh backend
bash scripts/logs.sh frontend
```

### Restart a Service
```bash
bash scripts/restart-service.sh user-service
bash scripts/restart-service.sh backend
```

### Update and Rebuild
```bash
bash scripts/update.sh
```

## 🌐 Service Ports

| Service | Host Port | Container Port | URL |
|---------|-----------|----------------|-----|
| Frontend | 5180 | 5173 | http://localhost:5180 |
| API Gateway | 4000 | 3000 | http://localhost:4000 |
| User Service | 3001 | 3001 | http://localhost:3001 |
| Project Service | 3002 | 3002 | http://localhost:3002 |
| Settings Service | 3003 | 3003 | http://localhost:3003 |
| Chat Service | 3004 | 3004 | http://localhost:3004 |
| PostgreSQL | 5433 | 5432 | localhost:5433 |
| Redis | 6379 | 6379 | localhost:6379 |

## 🔍 Health Checks

All services have health endpoints. Test them:

```bash
curl http://localhost:3001/health  # User Service
curl http://localhost:3002/health  # Project Service
curl http://localhost:3003/health  # Settings Service
curl http://localhost:3004/health  # Chat Service
curl http://localhost:4000/health  # API Gateway
```

## 🐛 Troubleshooting

### Services Not Starting

1. **Check logs:**
   ```bash
   docker-compose logs [service-name]
   ```

2. **Verify .env file:**
   ```bash
   cat .env | grep DB_
   ```

3. **Check database connection:**
   ```bash
   docker-compose exec postgres psql -U $DB_USER -d $DB_NAME
   ```

### Build Failures

1. **Clean Docker cache:**
   ```bash
   docker system prune -af
   ```

2. **Rebuild without cache:**
   ```bash
   docker-compose build --no-cache
   ```

3. **Build shared dependencies first:**
   ```bash
   docker build -t skillsbridge-shared:latest -f server/shared/Dockerfile ./server
   ```

### Database Issues

1. **Reset database (⚠️ deletes data):**
   ```bash
   docker-compose down -v
   docker-compose up -d postgres
   ```

2. **Check PostgreSQL logs:**
   ```bash
   docker-compose logs postgres
   ```

### Migration Errors

Migrations run automatically on startup. If they fail:
- Check database connection
- Verify database user has proper permissions
- Check service logs for specific error messages

## 📊 Key Improvements

1. **Simplified Architecture**: Removed shared-builder service, using direct builds
2. **Better Defaults**: All services have sensible defaults in docker-compose.yml
3. **Error Handling**: Health checks and migrations have proper error handling
4. **Migration Safety**: Migrations suppress errors if already applied
5. **Health Checks**: All services have robust health check endpoints
6. **Security**: Non-root users, internal networks for sensitive services

## 🎯 Next Steps After Deployment

1. **Test Services:**
   - Frontend: http://localhost:5180
   - API Gateway: http://localhost:4000/health

2. **Configure Nginx** (for production):
   - Setup reverse proxy
   - Configure SSL certificates

3. **Setup DNS:**
   - `skillsbridge.raorajan.pro` → Frontend
   - `skillsbridgeapi.raorajan.pro` → API Gateway

4. **Monitor Services:**
   - Check logs regularly
   - Monitor health endpoints
   - Setup alerts (optional)

## 📝 Notes

- The shared dependencies image (`skillsbridge-shared:latest`) must be built before other services
- Database migrations run automatically on service startup
- Frontend uses production build with `serve` for static file serving
- All services use multi-stage builds for smaller images
- PostgreSQL and Redis are on internal networks only

---

**Ready to deploy! Run `bash scripts/deploy.sh` to get started.**

