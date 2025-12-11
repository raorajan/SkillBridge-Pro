FROM node:18-alpine

WORKDIR /app

# Copy shared package first (needed by settings-service)
COPY shared/package*.json ./shared/
COPY shared/ ./shared/

# Copy settings-service package files
COPY services/settings-service/package*.json ./

# Install shared dependencies first
WORKDIR /app/shared
RUN npm install

# Install settings-service dependencies
WORKDIR /app
RUN npm install

# Copy settings-service application files
COPY services/settings-service/ ./

# Expose port
EXPOSE 3003

# Start the application
CMD ["node", "src/server.js"]

