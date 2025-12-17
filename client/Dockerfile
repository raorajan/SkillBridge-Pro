# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

COPY package*.json ./

RUN npm ci --no-audit --no-fund

COPY . .

# Build-time environment variables
ARG VITE_API_URL=https://skillsbridgeapi.raorajan.pro/
ARG VITE_APP_API_URL=https://skillsbridgeapi.raorajan.pro/
ARG VITE_FRONTEND_URL=https://skillsbridge.raorajan.pro/
ARG VITE_CHAT_SERVICE_URL=https://skillsbridgeapi.raorajan.pro
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_APP_API_URL=${VITE_APP_API_URL}
ENV VITE_FRONTEND_URL=${VITE_FRONTEND_URL}
ENV VITE_CHAT_SERVICE_URL=${VITE_CHAT_SERVICE_URL}
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}

RUN npm run build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

# Install serve
RUN npm install -g serve

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Copy built files
COPY --from=builder --chown=nodeuser:nodejs /app/dist ./dist

USER nodeuser

EXPOSE 5173

CMD ["serve", "-s", "dist", "-l", "5173"]
