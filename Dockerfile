# Use Node.js for building TypeScript
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

# Production stage - use nginx to serve static files
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html/dist
COPY --from=builder /app/index.html /usr/share/nginx/html/
COPY --from=builder /app/styles.css /usr/share/nginx/html/

# Copy nginx configuration template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Railway provides PORT env variable, default to 8080
ENV PORT=8080

EXPOSE $PORT

CMD ["nginx", "-g", "daemon off;"]
