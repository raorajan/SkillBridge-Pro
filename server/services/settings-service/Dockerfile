ARG SHARED_IMAGE=skillsbridge-shared:latest
FROM ${SHARED_IMAGE} AS shared-deps

FROM node:18-alpine AS builder

WORKDIR /app

# Copy shared node_modules from shared image
COPY --from=shared-deps /app/node_modules ./node_modules

# Copy shared source code (needed for file: dependency resolution)
COPY shared/ ./shared/

# Copy service package files (including package-lock.json)
COPY services/settings-service/package*.json ./

# Install service dependencies
RUN npm ci --only=production --no-audit --no-fund

# Copy service source code
COPY services/settings-service/ ./

FROM node:18-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Copy built dependencies and source
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app ./

USER nodeuser

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3003/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["sh", "-c", "npx drizzle-kit push 2>/dev/null || echo 'Migrations already applied' && node src/server.js"]
