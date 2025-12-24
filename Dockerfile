# Stage 1: Install dependencies and build all packages
FROM node:20-alpine AS builder
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
FROM node:20-alpine
WORKDIR /app

# Install PNPM
RUN npm install -g pnpm@8.12.0

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package.json files for all packages
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy Prisma schema (needed to generate client)
COPY packages/backend/prisma ./packages/backend/prisma

# Generate Prisma Client in production
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

# Run migrations and start backend server (which serves frontend)
CMD ["sh", "-c", "cd packages/backend && pnpm exec prisma migrate deploy && node dist/index.js"]
