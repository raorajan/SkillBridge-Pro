#!/bin/bash
# deploy.sh - SkillBridge Pro Microservices Deployment

set -e  # Exit on error

echo "🚀 Starting SkillBridge Pro Microservices Deployment..."
echo "======================================================"

cd ~/SkillBridge-Pro

# 1. Create necessary directories
mkdir -p scripts monitoring

# 2. Create database initialization script
cat > scripts/init-db.sql << 'SQL_EOF'
-- Create database schema for all services
CREATE SCHEMA IF NOT EXISTS user_service;
CREATE SCHEMA IF NOT EXISTS project_service;
CREATE SCHEMA IF NOT EXISTS settings_service;
CREATE SCHEMA IF NOT EXISTS chat_service;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
SQL_EOF

# 3. Stop any existing services
echo "Stopping existing services..."
docker-compose down --remove-orphans --volumes 2>/dev/null || true

# 4. Clean up old images
echo "Cleaning up old Docker images..."
docker system prune -af --volumes 2>/dev/null || true

# 5. Build shared dependencies first
echo "Building shared dependencies..."
docker build -t skillsbridge-shared:latest -f server/shared/Dockerfile ./server

# 6. Build and start services
echo "Building and starting microservices..."
docker-compose up --build -d

# 7. Wait for services to be healthy
echo "Waiting for services to become healthy..."
HEALTHY=false
for i in {1..30}; do
    if docker-compose ps | grep -q "Up (healthy)"; then
        HEALTHY=true
        echo "✅ Services are healthy!"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 10
done

if [ "$HEALTHY" = false ]; then
    echo "⚠️  Some services may not be healthy. Checking logs..."
    docker-compose logs --tail=20
fi

# 8. Display status
echo ""
echo "📊 Deployment Status:"
echo "====================="
docker-compose ps

# 9. Test endpoints
echo ""
echo "🧪 Testing endpoints..."
echo -n "Frontend: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:5180 || echo "Not available"
echo ""
echo -n "API Gateway: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health || echo "Not available"
echo ""
echo -n "User Service: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health || echo "Not available"
echo ""

# 10. Display access information
PUBLIC_IP=$(curl -4 -s ifconfig.me 2>/dev/null || echo "SERVER_IP")
echo ""
echo "🌐 Access Information:"
echo "======================"
echo "Local Access:"
echo "  Frontend:     http://localhost:5180"
echo "  API Gateway:  http://localhost:4000"
echo "  User Service: http://localhost:3001"
echo "  Project Svc:  http://localhost:3002"
echo ""
echo "Public Access (temporary):"
echo "  Frontend:     http://$PUBLIC_IP:5180"
echo "  API Gateway:  http://$PUBLIC_IP:4000"
echo ""
echo "Production URLs (after DNS & Nginx):"
echo "  Frontend:     https://skillsbridge.raorajan.pro"
echo "  API Gateway:  https://skillsbridgeapi.raorajan.pro"
echo ""
echo "📋 Next Steps:"
echo "  1. Add DNS records for skillsbridge.raorajan.pro"
echo "  2. Configure Nginx reverse proxy"
echo "  3. Setup SSL certificates with Certbot"
echo "  4. Test all API endpoints"
echo ""
echo "✅ Deployment complete!"
