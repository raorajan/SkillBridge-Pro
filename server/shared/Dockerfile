# Stage 1: Builder for shared dependencies
FROM node:18-alpine AS shared-builder

WORKDIR /app

# Copy shared package files
COPY shared/package*.json ./

# Install shared dependencies
RUN npm ci --only=production --no-audit --no-fund

# Create a clean image with only shared dependencies
FROM node:18-alpine AS shared-deps

WORKDIR /app

# Copy only node_modules from builder
COPY --from=shared-builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Set permissions
RUN chown -R nodeuser:nodejs /app

USER nodeuser

# This image only contains shared dependencies

