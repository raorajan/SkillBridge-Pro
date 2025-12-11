FROM node:18-alpine

WORKDIR /app

# Copy shared package first (needed by user-service)
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

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "src/server.js"]

