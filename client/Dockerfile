FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (needed for dev server)
RUN npm install

# Copy application files
COPY . .

# Expose port
EXPOSE 5173

# Start dev server (uses less memory than build + preview)
# For production build, use: RUN npm run build && npm run preview
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

