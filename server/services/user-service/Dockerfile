ARG SHARED_IMAGE=skillsbridge-shared:latest
FROM ${SHARED_IMAGE} AS shared-deps

FROM node:18-alpine AS builder

WORKDIR /app

COPY --from=shared-deps /app/node_modules ./node_modules

COPY services/user-service/package*.json ./

RUN npm ci --only=production --no-audit --no-fund

COPY services/user-service/ ./
COPY shared/ ./shared/

FROM node:18-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app ./

USER nodeuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["sh", "-c", "npx drizzle-kit push 2>/dev/null || echo 'Migrations already applied' && node src/server.js"]
