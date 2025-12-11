FROM node:18-alpine

WORKDIR /app

# Copy shared package first (needed by chat-service)
COPY shared/package*.json ./shared/
COPY shared/ ./shared/

# Copy chat-service package files
COPY services/chat-service/package*.json ./

# Install shared dependencies first
WORKDIR /app/shared
RUN npm install

# Install chat-service dependencies
WORKDIR /app
RUN npm install

# Copy chat-service application files
COPY services/chat-service/ ./

# Expose port
EXPOSE 3004

# Start the application
CMD ["node", "src/server.js"]

