# Hybrid Monolith API Plan

## Overview

**Architecture**: Keep existing Web Components frontend + Add Node.js backend API (Monolith)

**Strategy**: Extend the current application with a backend API layer while maintaining the existing client-side code. Both frontend and backend will live in the same codebase and be deployed together as a single monolith.

**Key Benefits**:
- ✅ Zero frontend rewrite (keep all existing components)
- ✅ Add multi-device sync capability
- ✅ Gradual migration (localStorage → database)
- ✅ Single codebase, single deployment
- ✅ Lower risk than full SSR migration
- ✅ Can evolve to full SSR later

---

## Current vs Target Architecture

### Current Architecture
```
┌─────────────────────────────────────┐
│         Browser (Client)            │
│  ┌──────────────────────────────┐   │
│  │   Web Components (TS)        │   │
│  │   - EntityGrid               │   │
│  │   - EntryList                │   │
│  │   - Forms                    │   │
│  └──────────────────────────────┘   │
│              ↓                       │
│  ┌──────────────────────────────┐   │
│  │   Store (State)              │   │
│  └──────────────────────────────┘   │
│              ↓                       │
│  ┌──────────────────────────────┐   │
│  │   LocalStorage               │   │
│  │   - entities                 │   │
│  │   - entries                  │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘

Static File Server (Nginx)
```

### Target Monolith Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Monolith Server                      │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Frontend (Static Assets)                │   │
│  │  ┌──────────────────────────────────────────┐   │   │
│  │  │   Web Components (TS) - UNCHANGED        │   │   │
│  │  │   - EntityGrid                           │   │   │
│  │  │   - EntryList                            │   │   │
│  │  │   - Forms                                │   │   │
│  │  └──────────────────────────────────────────┘   │   │
│  │              ↓                                   │   │
│  │  ┌──────────────────────────────────────────┐   │   │
│  │  │   Store (State) - ENHANCED               │   │   │
│  │  │   - localStorage fallback                │   │   │
│  │  │   - API sync layer                       │   │   │
│  │  └──────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
│                       ↕                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Backend (Node.js + Express)             │   │
│  │  ┌──────────────────────────────────────────┐   │   │
│  │  │   API Routes                             │   │   │
│  │  │   /api/entities                          │   │   │
│  │  │   /api/entries                           │   │   │
│  │  │   /api/sync                              │   │   │
│  │  │   /api/auth                              │   │   │
│  │  └──────────────────────────────────────────┘   │   │
│  │              ↓                                   │   │
│  │  ┌──────────────────────────────────────────┐   │   │
│  │  │   Database Layer (Prisma)                │   │   │
│  │  └──────────────────────────────────────────┘   │   │
│  │              ↓                                   │   │
│  │  ┌──────────────────────────────────────────┐   │   │
│  │  │   PostgreSQL Database                    │   │   │
│  │  │   - entities table                       │   │   │
│  │  │   - entries table                        │   │   │
│  │  │   - users table                          │   │   │
│  │  └──────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

Single Docker Container / Single Railway Deployment
```

---

## Technology Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js (minimal, fast)
- **ORM**: Prisma (type-safe database access)
- **Database**: PostgreSQL (Neon free tier)
- **Auth**: Passport.js or simple JWT
- **Validation**: Zod (matches frontend TypeScript types)

### Frontend (Unchanged)
- **Components**: Web Components (existing)
- **Language**: TypeScript
- **State**: Store pattern (enhanced with API layer)
- **Storage**: localStorage + API sync

### Build & Deploy
- **Monorepo Structure**: PNPM workspaces with Turborepo
- **Frontend Build**: TypeScript compiler (existing)
- **Backend Build**: TypeScript compiler (ts-node-dev for dev)
- **Shared Types**: TypeScript compiler (builds first)
- **Deployment**: Single Docker image (Railway/Render)
- **Process Manager**: Node.js (production)

---

## Project Structure (Monorepo)

```
trackly/                              # Monorepo root
├── packages/
│   ├── frontend/                     # Frontend package
│   │   ├── src/
│   │   │   ├── components/          # Web Components (unchanged)
│   │   │   ├── models/              # Data models (unchanged)
│   │   │   ├── state/               # Store (enhanced)
│   │   │   ├── utils/               # Utilities (enhanced)
│   │   │   ├── services/            # NEW: API client services
│   │   │   │   ├── api.ts          # API client wrapper
│   │   │   │   ├── entities.service.ts
│   │   │   │   ├── entries.service.ts
│   │   │   │   └── sync.service.ts
│   │   │   └── app.ts               # Main app
│   │   ├── public/
│   │   │   ├── index.html
│   │   │   └── styles.css
│   │   ├── dist/                    # Compiled frontend
│   │   ├── package.json             # Frontend dependencies
│   │   ├── tsconfig.json
│   │   └── vite.config.ts           # Optional: Vite for faster dev
│   │
│   ├── backend/                      # Backend package
│   │   ├── src/
│   │   │   ├── index.ts             # Express server entry
│   │   │   ├── routes/
│   │   │   │   ├── entities.ts
│   │   │   │   ├── entries.ts
│   │   │   │   ├── sync.ts
│   │   │   │   └── auth.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── validation.ts
│   │   │   │   └── errorHandler.ts
│   │   │   ├── db/
│   │   │   │   └── client.ts        # Prisma client
│   │   │   └── utils/
│   │   │       └── helpers.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── dist/                     # Compiled backend
│   │   ├── package.json              # Backend dependencies
│   │   └── tsconfig.json
│   │
│   └── shared/                       # NEW: Shared types package
│       ├── src/
│       │   ├── types/
│       │   │   ├── entity.ts        # Shared Entity types
│       │   │   ├── entry.ts         # Shared Entry types
│       │   │   └── api.ts           # API request/response types
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── package.json                      # Root package.json (workspaces)
├── pnpm-workspace.yaml               # PNPM workspaces config
├── turbo.json                        # Turborepo config (optional)
├── docker-compose.yml                # Local dev with DB
├── Dockerfile                        # Production build
├── .env                              # Environment variables
└── .gitignore
```

---

## Database Schema (Prisma)

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String   // Hashed with bcrypt
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  entities  Entity[]
  entries   Entry[]

  @@index([email])
}

model Entity {
  id         String   @id @default(cuid())
  name       String
  type       String
  categories String[] // PostgreSQL array
  valueType  String?
  options    Json?    // Store as JSONB
  properties Json?    // Store as JSONB
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  entries    Entry[]

  @@index([userId])
  @@index([name])
}

model Entry {
  id                    String   @id @default(cuid())
  entityId              String
  entityName            String   // Denormalized for faster queries
  timestamp             DateTime
  value                 String?
  valueDisplay          String?
  notes                 String?
  images                String[] // Base64 or URLs
  propertyValues        Json?
  propertyValueDisplays Json?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  userId                String
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  entity                Entity   @relation(fields: [entityId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([entityId])
  @@index([timestamp])
}
```

---

## Implementation Plan

### Phase 1: Backend Foundation (2 days)

**Tasks**:
- [ ] Set up monorepo structure with PNPM workspaces
- [ ] Create `packages/shared` with shared TypeScript types
- [ ] Set up Express server in `packages/backend`
- [ ] Configure Prisma with PostgreSQL (Neon) in `packages/backend`
- [ ] Create database schema
- [ ] Set up TypeScript configs for all packages
- [ ] Configure Turborepo for build orchestration
- [ ] Update build scripts in root package.json
- [ ] Create `.env` file for environment variables
- [ ] Set up basic error handling middleware

**Deliverables**:
- Express server running on `http://localhost:3000`
- Prisma migrations created
- Frontend still served from `/` route
- Health check endpoint: `GET /api/health`

**Code Example**:

```typescript
// packages/backend/src/index.ts
import express from 'express';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import entityRoutes from './routes/entities';
import entryRoutes from './routes/entries';
import authRoutes from './routes/auth';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' })); // For base64 images

// Serve frontend static files from monorepo
const frontendPublicPath = path.join(__dirname, '../../../frontend/public');
const frontendDistPath = path.join(__dirname, '../../../frontend/dist');
app.use(express.static(frontendPublicPath));
app.use('/dist', express.static(frontendDistPath));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/entries', entryRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPublicPath, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export { prisma };
```

```typescript
// packages/backend/src/routes/entities.ts
import { Router } from 'express';
import { prisma } from '../index';
import { requireAuth } from '../middleware/auth';
import { IEntity } from '@trackly/shared';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/entities - List all entities for user
router.get('/', async (req, res) => {
  const userId = req.user.id;

  const entities = await prisma.entity.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  res.json(entities);
});

// POST /api/entities - Create new entity
router.post('/', async (req, res) => {
  const userId = req.user.id;
  const { name, type, categories, valueType, options, properties } = req.body;

  const entity = await prisma.entity.create({
    data: {
      name,
      type,
      categories,
      valueType,
      options,
      properties,
      userId,
    },
  });

  res.status(201).json(entity);
});

// PUT /api/entities/:id - Update entity
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Verify ownership
  const entity = await prisma.entity.findFirst({
    where: { id, userId },
  });

  if (!entity) {
    return res.status(404).json({ error: 'Entity not found' });
  }

  const updated = await prisma.entity.update({
    where: { id },
    data: req.body,
  });

  res.json(updated);
});

// DELETE /api/entities/:id - Delete entity (cascade deletes entries)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const entity = await prisma.entity.findFirst({
    where: { id, userId },
  });

  if (!entity) {
    return res.status(404).json({ error: 'Entity not found' });
  }

  await prisma.entity.delete({ where: { id } });

  res.status(204).send();
});

export default router;
```

---

### Phase 2: API Implementation (2 days)

**Tasks**:
- [ ] Implement all entity CRUD endpoints
- [ ] Implement all entry CRUD endpoints
- [ ] Add JWT authentication
- [ ] Add request validation (Zod)
- [ ] Add error handling middleware
- [ ] Test all endpoints with Postman/Thunder Client

**Deliverables**:
- Complete REST API for entities and entries
- Auth endpoints: `/api/auth/register`, `/api/auth/login`
- Protected routes with JWT middleware

**Endpoints**:

```
Authentication
POST   /api/auth/register      # Create new user
POST   /api/auth/login         # Login and get JWT token

Entities
GET    /api/entities           # List all user's entities
POST   /api/entities           # Create new entity
GET    /api/entities/:id       # Get single entity
PUT    /api/entities/:id       # Update entity
DELETE /api/entities/:id       # Delete entity (cascade)

Entries
GET    /api/entries            # List all user's entries
GET    /api/entries?entityId=X # Filter by entity
POST   /api/entries            # Create new entry
GET    /api/entries/:id        # Get single entry
PUT    /api/entries/:id        # Update entry
DELETE /api/entries/:id        # Delete entry

Sync
POST   /api/sync               # Bulk sync (upsert all data)
GET    /api/sync/status        # Get last sync timestamp
```

**Code Example**:

```typescript
// packages/backend/src/middleware/auth.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    req.user = { id: decoded.userId, email: decoded.email };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

```typescript
// packages/backend/src/routes/auth.ts
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../index';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    // Generate token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '30d',
    });

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '30d',
    });

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
```

---

### Phase 3: Frontend API Integration (2 days)

**Tasks**:
- [ ] Create API client service layer
- [ ] Add auth state management (JWT storage)
- [ ] Update Store to use API calls
- [ ] Implement localStorage → API fallback strategy
- [ ] Add sync UI (sync button in header)
- [ ] Add login/register UI components
- [ ] Add loading states and error handling

**Deliverables**:
- Frontend can authenticate users
- Frontend calls API for CRUD operations
- Offline-first with localStorage fallback
- Sync button to push local data to server

**Code Example**:

```typescript
// packages/frontend/src/services/api.ts
import { IEntity, IEntry } from '@trackly/shared';

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    // Load token from localStorage on init
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken();
        window.location.href = '/login';
      }
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async register(email: string, password: string, name?: string) {
    const data = await this.request<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    this.setToken(data.token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  logout() {
    this.clearToken();
    window.location.href = '/';
  }

  // Entities
  async getEntities() {
    return this.request<Entity[]>('/entities');
  }

  async createEntity(entity: Omit<Entity, 'id' | 'createdAt'>) {
    return this.request<Entity>('/entities', {
      method: 'POST',
      body: JSON.stringify(entity),
    });
  }

  async updateEntity(id: string, updates: Partial<Entity>) {
    return this.request<Entity>(`/entities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteEntity(id: string) {
    return this.request<void>(`/entities/${id}`, { method: 'DELETE' });
  }

  // Entries
  async getEntries(entityId?: string) {
    const query = entityId ? `?entityId=${entityId}` : '';
    return this.request<Entry[]>(`/entries${query}`);
  }

  async createEntry(entry: Omit<Entry, 'id' | 'createdAt'>) {
    return this.request<Entry>('/entries', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  async updateEntry(id: string, updates: Partial<Entry>) {
    return this.request<Entry>(`/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteEntry(id: string) {
    return this.request<void>(`/entries/${id}`, { method: 'DELETE' });
  }

  // Sync
  async sync(data: { entities: Entity[]; entries: Entry[] }) {
    return this.request('/sync', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
```

```typescript
// packages/frontend/src/state/Store.ts - Enhanced with API support
import { IEntity, IEntry } from '@trackly/shared';
import { api } from '../services/api';

export class Store {
  private entities: Entity[] = [];
  private entries: Entry[] = [];
  private listeners: StoreListener[] = [];
  private selectedEntityId: string | null = null;
  private isOnline: boolean = true;
  private syncMode: 'local' | 'api' = 'local'; // Toggle between modes

  constructor() {
    this.loadFromLocalStorage();
    this.checkOnlineStatus();

    // Auto-detect if user is logged in
    if (localStorage.getItem('auth_token')) {
      this.syncMode = 'api';
      this.syncFromServer();
    }
  }

  // Enable API mode after login
  async enableApiMode() {
    this.syncMode = 'api';
    await this.syncFromServer();
  }

  // Disable API mode (logout)
  disableApiMode() {
    this.syncMode = 'local';
    api.logout();
  }

  // Sync from server
  async syncFromServer() {
    try {
      const [entities, entries] = await Promise.all([
        api.getEntities(),
        api.getEntries(),
      ]);

      this.entities = entities;
      this.entries = entries;

      // Update localStorage as cache
      this.saveToLocalStorage();
      this.notify();
    } catch (error) {
      console.error('Sync failed:', error);
      // Fall back to localStorage
      this.loadFromLocalStorage();
    }
  }

  // Sync to server (push local data)
  async syncToServer() {
    if (this.syncMode !== 'api') return;

    try {
      await api.sync({
        entities: this.entities,
        entries: this.entries,
      });
    } catch (error) {
      console.error('Sync to server failed:', error);
    }
  }

  // Enhanced addEntity - works in both modes
  async addEntity(entity: Entity): Promise<void> {
    if (this.syncMode === 'api') {
      // API mode - create on server
      const created = await api.createEntity(entity);
      this.entities.push(created);
    } else {
      // Local mode - add to localStorage
      this.entities.push(entity);
    }

    this.saveToLocalStorage();
    this.notify();
  }

  // Enhanced updateEntity
  async updateEntity(id: string, updates: Partial<IEntity>): Promise<void> {
    const index = this.entities.findIndex(e => e.id === id);
    if (index === -1) return;

    if (this.syncMode === 'api') {
      const updated = await api.updateEntity(id, updates);
      this.entities[index] = updated;
    } else {
      const entity = this.entities[index];
      this.entities[index] = { ...entity, ...updates } as Entity;
    }

    this.saveToLocalStorage();
    this.notify();
  }

  // Similar for deleteEntity, addEntry, updateEntry, deleteEntry...
}
```

---

### Phase 4: Deployment & Testing (1 day)

**Tasks**:
- [ ] Update Dockerfile for monolith
- [ ] Configure environment variables
- [ ] Set up PostgreSQL on Railway/Render
- [ ] Deploy to production
- [ ] Test all features end-to-end
- [ ] Add monitoring/logging

**Deliverables**:
- Production deployment with database
- Environment variables configured
- SSL certificate (automatic with Railway)

**Dockerfile Update (Monorepo)**:

```dockerfile
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

# Copy built files from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/frontend/dist ./packages/frontend/dist
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Copy static assets
COPY packages/frontend/public ./packages/frontend/public

# Copy Prisma files and generated client
COPY --from=builder /app/packages/backend/prisma ./packages/backend/prisma
COPY --from=builder /app/packages/backend/node_modules/.prisma ./packages/backend/node_modules/.prisma
COPY --from=builder /app/packages/backend/node_modules/@prisma ./packages/backend/node_modules/@prisma

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Run migrations and start backend server (which serves frontend)
CMD ["sh", "-c", "cd packages/backend && pnpm exec prisma migrate deploy && node dist/index.js"]
```

---

## Data Migration Strategy

### Migrating from LocalStorage to Database

**Approach**: Provide an import tool for users to upload their local data

**Steps**:

1. **Export from localStorage**:
```typescript
// Add to packages/frontend/src/state/Store.ts
exportData(): string {
  const data = {
    entities: this.entities,
    entries: this.entries,
    version: '1.0',
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}
```

2. **Import endpoint**:
```typescript
// packages/backend/src/routes/sync.ts
router.post('/import', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { entities, entries } = req.body;

  // Use transaction for atomicity
  await prisma.$transaction(async (tx) => {
    // Clear existing data
    await tx.entry.deleteMany({ where: { userId } });
    await tx.entity.deleteMany({ where: { userId } });

    // Import entities
    for (const entity of entities) {
      await tx.entity.create({
        data: { ...entity, userId },
      });
    }

    // Import entries
    for (const entry of entries) {
      await tx.entry.create({
        data: { ...entry, userId },
      });
    }
  });

  res.json({ success: true, imported: { entities: entities.length, entries: entries.length } });
});
```

3. **UI for import**:
```typescript
// Add import button to settings/header
async function handleImport(file: File) {
  const text = await file.text();
  const data = JSON.parse(text);

  await api.request('/sync/import', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  alert('Data imported successfully!');
  location.reload();
}
```

---

## Monorepo Configuration

### Root package.json

```json
// package.json (root)
{
  "name": "trackly-monorepo",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "start": "pnpm --filter backend start",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "clean": "turbo run clean && rm -rf node_modules",

    "db:migrate": "pnpm --filter backend db:migrate",
    "db:push": "pnpm --filter backend db:push",
    "db:seed": "pnpm --filter backend db:seed",
    "db:studio": "pnpm --filter backend db:studio",

    "docker:build": "docker build -t trackly .",
    "docker:run": "docker run -p 3000:3000 --env-file .env trackly"
  },
  "devDependencies": {
    "turbo": "^1.11.2",
    "typescript": "^5.3.3"
  },
  "packageManager": "pnpm@8.12.0"
}
```

### PNPM Workspace Config

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
```

### Turborepo Config (Optional but Recommended)

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "clean": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "db:push": {
      "cache": false
    }
  }
}
```

### Frontend Package

```json
// packages/frontend/package.json
{
  "name": "@trackly/frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsc --watch",
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@trackly/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "live-server": "^1.2.2"
  }
}
```

### Backend Package

```json
// packages/backend/package.json
{
  "name": "@trackly/backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "clean": "rm -rf dist",

    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:seed": "ts-node prisma/seed.ts",
    "db:studio": "prisma studio",
    "db:generate": "prisma generate"
  },
  "dependencies": {
    "@trackly/shared": "workspace:*",
    "@prisma/client": "^5.7.0",
    "bcrypt": "^5.1.1",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/node": "^20.10.5",
    "prisma": "^5.7.0",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.3.3"
  }
}
```

### Shared Package

```json
// packages/shared/package.json
{
  "name": "@trackly/shared",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "dev": "tsc --watch",
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

### Shared Types Example

```typescript
// packages/shared/src/types/entity.ts
export interface IEntity {
  id: string;
  name: string;
  type: EntityType;
  categories: string[];
  valueType?: ValueType;
  options?: SelectOption[];
  properties?: EntityProperty[];
  createdAt: string;
  updatedAt?: string;
}

export type EntityType =
  | 'Habit'
  | 'Task'
  | 'Mood'
  | 'Node'
  | 'Event'
  | 'Idea'
  | 'Book'
  // ... more types

export type ValueType =
  | 'checkbox'
  | 'text'
  | 'number'
  | 'range'
  | 'select'
  | 'datetime-local'
  // ... more types

export interface EntityProperty {
  id: string;
  name: string;
  valueType: ValueType;
  required: boolean;
  options?: SelectOption[];
}

export interface SelectOption {
  value: string;
  label: string;
}
```

```typescript
// packages/shared/src/index.ts
export * from './types/entity';
export * from './types/entry';
export * from './types/api';
```

### Using Shared Types

```typescript
// In frontend: packages/frontend/src/services/api.ts
import { IEntity, IEntry } from '@trackly/shared';

class ApiClient {
  async getEntities(): Promise<IEntity[]> {
    return this.request<IEntity[]>('/entities');
  }
}
```

```typescript
// In backend: packages/backend/src/routes/entities.ts
import { Router } from 'express';
import { IEntity } from '@trackly/shared';

router.get('/', async (req, res) => {
  const entities: IEntity[] = await prisma.entity.findMany();
  res.json(entities);
});
```

---

## Docker Compose (Local Development)

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: trackly-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: trackly
      POSTGRES_PASSWORD: trackly
      POSTGRES_DB: trackly_dev
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Usage**:
```bash
# Start PostgreSQL
docker-compose up -d

# Stop PostgreSQL
docker-compose down

# View logs
docker-compose logs -f postgres

# Reset database (WARNING: deletes all data)
docker-compose down -v
```

**Connection String for .env**:
```bash
DATABASE_URL="postgresql://trackly:trackly@localhost:5432/trackly_dev"
```

---

## Environment Variables

```bash
# .env (local development)
NODE_ENV=development
PORT=3000

# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# Frontend URL (for CORS)
FRONTEND_URL="http://localhost:3000"

# Optional: Image upload (if using S3/Cloudinary)
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_BUCKET_NAME=
```

```bash
# .env.production (Railway/Render)
NODE_ENV=production
PORT=3000
DATABASE_URL=${{Railway.DATABASE_URL}}  # Auto-injected by Railway
JWT_SECRET=${{Railway.JWT_SECRET}}      # Set in Railway dashboard
```

---

## Testing Checklist

### Backend API
- [ ] User registration works
- [ ] User login returns JWT
- [ ] JWT authentication protects routes
- [ ] Create entity (authenticated)
- [ ] Update entity (only owner)
- [ ] Delete entity (only owner, cascade to entries)
- [ ] Create entry
- [ ] Update entry
- [ ] Delete entry
- [ ] Sync endpoint accepts bulk data
- [ ] Error handling for invalid data
- [ ] Error handling for unauthorized access

### Frontend Integration
- [ ] Login UI works
- [ ] Register UI works
- [ ] Token stored in localStorage
- [ ] API mode enabled after login
- [ ] Creating entity calls API
- [ ] Updating entity calls API
- [ ] Deleting entity calls API
- [ ] Creating entry calls API
- [ ] Updating entry calls API
- [ ] Deleting entry calls API
- [ ] Sync button pushes local data
- [ ] Logout clears token and switches to local mode
- [ ] Offline mode falls back to localStorage
- [ ] Data persists across sessions

### Migration
- [ ] Export button downloads JSON
- [ ] Import endpoint accepts JSON
- [ ] Imported data appears in app
- [ ] No duplicate data after import

---

## Deployment Guide

### Railway Deployment

1. **Create new Railway project**:
```bash
railway init
```

2. **Add PostgreSQL service**:
```bash
railway add
# Select: PostgreSQL
```

3. **Set environment variables**:
```bash
railway variables set JWT_SECRET="$(openssl rand -base64 32)"
```

4. **Deploy**:
```bash
railway up
```

5. **Run migrations**:
```bash
railway run pnpm --filter @trackly/backend exec prisma migrate deploy
```

### Render Deployment

1. Create new Web Service
2. Connect GitHub repo
3. Build command: `npm install -g pnpm@8.12.0 && pnpm install && pnpm build && pnpm --filter @trackly/backend exec prisma migrate deploy`
4. Start command: `pnpm start`
5. Add PostgreSQL database (free tier)
6. Set environment variables in dashboard

---

## Timeline Summary

| Phase | Tasks | Duration |
|-------|-------|----------|
| **Phase 1**: Backend Foundation | Express, Prisma, DB schema | 2 days |
| **Phase 2**: API Implementation | CRUD endpoints, auth, validation | 2 days |
| **Phase 3**: Frontend Integration | API client, Store updates, UI | 2 days |
| **Phase 4**: Deployment & Testing | Docker, production deploy, E2E tests | 1 day |
| **Total** | | **7 days** |

---

## Cost Estimate (Free Tier)

| Service | Free Tier | Limits |
|---------|-----------|--------|
| **Neon PostgreSQL** | ✅ Free | 512 MB storage, 1 database |
| **Railway** | ✅ $5 credit/month | ~100 hours runtime |
| **Render** | ✅ Free | 750 hours/month |
| **Vercel** | ✅ Free | Hobby projects |

**Recommended**: Neon (DB) + Railway (hosting) = **$0-5/month**

---

## Future Enhancements

### After Initial Monolith
- [ ] Real-time sync with WebSockets
- [ ] Offline-first with service workers
- [ ] Multi-device conflict resolution
- [ ] Sharing entities/entries with other users
- [ ] Public entity templates
- [ ] Data export/import formats (CSV, JSON)
- [ ] API webhooks for integrations
- [ ] Mobile app (React Native using same API)

### Potential Microservices Split (if needed)
```
Frontend (Static) → Nginx
API Gateway (Express)
  ├─ Auth Service
  ├─ Entity Service
  ├─ Entry Service
  └─ Sync Service
Database (PostgreSQL)
Cache (Redis)
```

But stick with monolith until you need to scale!

---

## Success Criteria

✅ **MVP Complete When**:
- Users can register and login
- Users can create/edit/delete entities (synced to DB)
- Users can create/edit/delete entries (synced to DB)
- Data persists across devices
- Export/import from localStorage works
- Deployed to production with SSL

✅ **Production Ready When**:
- Error handling covers all edge cases
- Loading states for all async operations
- Offline mode gracefully degrades
- All existing features work (hashtags, images, markdown)
- Performance benchmarks met (< 200ms API response)
- Security audit passed (JWT, CORS, SQL injection prevention)

---

## Next Steps

1. **Review this plan** and ask any questions
2. **Set up local development environment**:
   ```bash
   # Install PNPM globally if not already installed
   npm install -g pnpm@8.12.0

   # Install all dependencies for monorepo
   pnpm install

   # Start PostgreSQL locally
   docker-compose up -d

   # Run database migrations
   pnpm run db:migrate

   # Start all packages in development mode
   pnpm run dev
   ```
3. **Create GitHub branch**: `feature/hybrid-monolith-api`
4. **Start Phase 1**: Backend foundation
   - Create monorepo structure (`packages/frontend`, `packages/backend`, `packages/shared`)
   - Set up PNPM workspaces and Turborepo
   - Initialize backend with Express and Prisma
5. **Commit frequently** and push to branch
6. **Open PR** when Phase 1 complete for review

---

**Document Version**: 1.0
**Last Updated**: 2025-12-23
**Estimated Effort**: 7 days (1 week full-time)
**Risk Level**: 🟢 Low (existing frontend unchanged)
**Recommended**: ✅ Yes - Best balance of effort/value
