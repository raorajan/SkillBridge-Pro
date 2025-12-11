FROM node:18-alpine

WORKDIR /app

# Copy shared package first (needed by project-service)
COPY shared/package*.json ./shared/
COPY shared/ ./shared/

# Copy project-service package files
COPY services/project-service/package*.json ./

# Install shared dependencies first
WORKDIR /app/shared
RUN npm install

# Install project-service dependencies
WORKDIR /app
RUN npm install

# Copy project-service application files
COPY services/project-service/ ./

# Expose port
EXPOSE 3002

# Start the application
CMD ["node", "src/server.js"]

