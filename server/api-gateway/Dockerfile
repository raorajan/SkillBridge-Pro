FROM node:18-alpine

WORKDIR /app

# Copy shared package first (needed by api-gateway)
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

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "src/index.js"]

