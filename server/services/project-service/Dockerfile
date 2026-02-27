FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create log directory
RUN mkdir -p /app/log

EXPOSE 3007

CMD ["node", "src/server.js"]
