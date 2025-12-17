# Stage 1: Shared dependencies
ARG SHARED_IMAGE=skillsbridge-shared:latest
FROM ${SHARED_IMAGE} AS shared-deps

# Stage 2: Builder
FROM node:18-alpine AS builder

WORKDIR /app

# Copy shared node_modules from shared image
COPY --from=shared-deps /app/node_modules ./node_modules

# Copy shared source code (needed for file: dependency resolution)
COPY shared/ ./shared/

# Copy api-gateway package files (including package-lock.json)
COPY api-gateway/package*.json ./

# Install api-gateway dependencies
RUN npm ci --only=production --no-audit --no-fund

# Copy api-gateway source code
COPY api-gateway/ ./

FROM node:18-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Copy built dependencies and source
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app ./

USER nodeuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/index.js"]
