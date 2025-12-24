# Stage 1: Install dependencies and build all packages
FROM node:20-slim AS builder
WORKDIR /app

# Install PNPM
RUN npm install -g pnpm@8.12.0

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./

# Copy all packages
COPY packages/ ./packages/

# Install dependencies for all workspaces
RUN pnpm install --frozen-lockfile

# Generate Prisma Client
RUN pnpm --filter @trackly/backend exec prisma generate

# Build all packages (shared → frontend → backend)
RUN pnpm build

# Stage 2: Production
FROM node:20-slim
WORKDIR /app

# Install OpenSSL and required libraries for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install PNPM
RUN npm install -g pnpm@8.12.0

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package.json files for all packages
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies (now includes prisma CLI)
RUN pnpm install --prod --frozen-lockfile

# Copy Prisma schema
COPY packages/backend/prisma ./packages/backend/prisma

# Generate Prisma Client (prisma CLI is now available in prod dependencies)
RUN pnpm --filter @trackly/backend exec prisma generate

# Copy built files from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/frontend/dist ./packages/frontend/dist
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Copy static assets
COPY packages/frontend/public ./packages/frontend/public

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Run migrations (if DATABASE_URL is set) and start backend server
CMD ["sh", "-c", "cd packages/backend && if [ -n \"$DATABASE_URL\" ]; then pnpm exec prisma migrate deploy; fi && node dist/index.js"]
