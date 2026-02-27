#!/bin/bash

# ============================================
# SkillBridge Pro - Server Setup Script
# Run this on your Ubuntu server to install dependencies
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Update system
log_info "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
log_info "Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    log_success "Node.js installed: $(node -v)"
else
    log_warning "Node.js already installed: $(node -v)"
fi

# Install Docker
log_info "Installing Docker..."
if ! command -v docker &> /dev/null; then
    sudo apt install -y docker.io
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker $USER
    log_success "Docker installed: $(docker --version)"
else
    log_warning "Docker already installed: $(docker --version)"
fi

# Install Docker Compose
log_info "Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    sudo apt install -y docker-compose-plugin
    log_success "Docker Compose installed"
else
    log_warning "Docker Compose already installed"
fi

# Install Nginx
log_info "Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
    log_success "Nginx installed: $(nginx -v 2>&1 | head -n1)"
else
    log_warning "Nginx already installed"
fi

# Install Certbot for SSL
log_info "Installing Certbot..."
if ! command -v certbot &> /dev/null; then
    sudo apt install -y certbot python3-certbot-nginx
    log_success "Certbot installed"
else
    log_warning "Certbot already installed"
fi

# Install PM2
log_info "Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    log_success "PM2 installed"
else
    log_warning "PM2 already installed"
fi

# Install PostgreSQL client (optional, for debugging)
log_info "Installing PostgreSQL client..."
sudo apt install -y postgresql-client

# Setup firewall
log_info "Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
sudo ufw allow 3002/tcp
sudo ufw allow 3003/tcp
sudo ufw allow 3004/tcp
sudo ufw --force enable

log_success "Firewall configured"

# Create app directory
log_info "Creating application directory..."
mkdir -p ~/skillbridge
log_success "Directory created at ~/skillbridge"

log_success "========================================"
log_success "Server setup completed!"
log_success "========================================"
log_info ""
log_info "Next steps:"
log_info "1. Copy your project files to ~/skillbridge"
log_info "2. Configure your .env file"
log_info "3. Run: cd ~/skillbridge && ./deploy.sh"
log_info ""
log_info "To setup SSL certificate:"
log_info "  sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com"
