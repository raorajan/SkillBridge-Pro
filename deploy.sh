#!/bin/bash

# ============================================
# SkillBridge Pro - Deployment Script
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="skillbridge"
BACKUP_DIR="./backups"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
check_env() {
    if [ ! -f .env ]; then
        log_error ".env file not found!"
        log_info "Please copy .env.example to .env and configure your settings:"
        log_info "  cp .env.example .env"
        exit 1
    fi
    log_success ".env file found"
}

# Create backup directory
setup_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        log_info "Created backup directory: $BACKUP_DIR"
    fi
}

# Backup database
backup_database() {
    log_info "Creating database backup..."
    
    # Load DB credentials from .env
    source .env
    
    BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sql"
    
    if docker exec skillbridge-postgres pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null; then
        log_success "Database backup created: $BACKUP_FILE"
    else
        log_warning "Could not create database backup (database may not be running)"
    fi
}

# Deploy application
deploy() {
    log_info "Starting SkillBridge Pro deployment..."
    
    # Check environment
    check_env
    
    # Setup backup directory
    setup_backup_dir
    
    # Backup database before deployment
    backup_database
    
    # Pull latest changes if git repo
    if [ -d .git ]; then
        log_info "Pulling latest changes from git..."
        git pull origin main || log_warning "Could not pull from git"
    fi
    
    # Build and start containers
    log_info "Building and starting Docker containers..."
    docker-compose down
    docker-compose up -d --build
    
    # Wait for services to be healthy
    log_info "Waiting for services to start..."
    sleep 10
    
    # Check service health
    log_info "Checking service health..."
    
    SERVICES=("skillbridge-postgres" "skillbridge-user-service" "skillbridge-project-service" "skillbridge-settings-service" "skillbridge-chat-service" "skillbridge-api-gateway" "skillbridge-frontend")
    
    for service in "${SERVICES[@]}"; do
        if docker ps | grep -q "$service"; then
            log_success "$service is running"
        else
            log_error "$service is not running"
        fi
    done
    
    # Run database migrations
    log_info "Running database migrations..."
    cd server
    npm run db:migrate || log_warning "Migration may have issues - check logs"
    cd ..
    
    log_success "Deployment completed!"
    log_info ""
    log_info "Your application should be available at:"
    log_info "  - Frontend: http://localhost"
    log_info "  - API Gateway: http://localhost:3000"
    log_info "  - API Docs: http://localhost:3000/api-docs"
    log_info ""
    log_info "To view logs: docker-compose logs -f"
    log_info "To stop: docker-compose down"
}

# View logs
view_logs() {
    docker-compose logs -f
}

# Stop application
stop() {
    log_info "Stopping SkillBridge Pro..."
    docker-compose down
    log_success "Application stopped"
}

# Restart application
restart() {
    log_info "Restarting SkillBridge Pro..."
    docker-compose restart
    log_success "Application restarted"
}

# Update application (pull latest and redeploy)
update() {
    log_info "Updating SkillBridge Pro..."
    
    if [ -d .git ]; then
        git pull origin main
    fi
    
    deploy
}

# Show status
status() {
    log_info "Service Status:"
    docker-compose ps
}

# Main menu
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    logs)
        view_logs
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    update)
        update
        ;;
    status)
        status
        ;;
    backup)
        check_env
        setup_backup_dir
        backup_database
        ;;
    *)
        echo "Usage: $0 {deploy|logs|stop|restart|update|status|backup}"
        echo ""
        echo "Commands:"
        echo "  deploy  - Deploy the application (default)"
        echo "  logs    - View container logs"
        echo "  stop    - Stop all containers"
        echo "  restart - Restart all containers"
        echo "  update  - Pull latest changes and redeploy"
        echo "  status  - Show container status"
        echo "  backup  - Create database backup"
        exit 1
        ;;
esac
