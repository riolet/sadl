FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY src/ ./src/
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Production image
FROM nginx:alpine

# Copy built files and static assets
COPY --from=builder /app/dist/ /usr/share/nginx/html/dist/
COPY demo.html /usr/share/nginx/html/index.html
COPY example.sadl /usr/share/nginx/html/
COPY examples/ /usr/share/nginx/html/examples/

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
