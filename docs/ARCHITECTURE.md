# Trackly Architecture

> Last updated: January 2026

This document describes the current architecture of Trackly, a personal tracking application for logging habits, tasks, activities, and more.

## Table of Contents

- [Overview](#overview)
- [Monorepo Structure](#monorepo-structure)
- [Technology Stack](#technology-stack)
- [Architectural Decisions](#architectural-decisions)
- [Data Model](#data-model)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [API Design](#api-design)
- [Authentication & Authorization](#authentication--authorization)
- [Data Flow](#data-flow)
- [Build & Deployment](#build--deployment)
- [Security](#security)
- [Performance Considerations](#performance-considerations)

## Overview

Trackly is a full-stack TypeScript application built as a monorepo with three packages:
- **Backend**: Express REST API with PostgreSQL database
- **Frontend**: TypeScript Web Components application
- **Shared**: Common TypeScript types

### Key Characteristics

- **Standards-based**: Native Web Components, ES modules, modern browser APIs
- **Type-safe**: Full TypeScript across frontend and backend
- **Stateless**: JWT authentication, URL-based navigation state
- **User-centric**: Multi-user support with user-scoped data
- **Extensible**: Custom entities and properties system

## Monorepo Structure

```
trackly/
├── package.json                  # Root workspace config (pnpm + turbo)
├── turbo.json                    # Turborepo build orchestration
├── Dockerfile                    # Multi-stage production build
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md          # This file
│   └── adr/                     # Architecture Decision Records
└── packages/
    ├── backend/                  # Express REST API
    │   ├── prisma/
    │   │   ├── schema.prisma    # Database schema
    │   │   ├── migrations/      # Database migrations
    │   │   └── seed.ts          # Seed data script
    │   └── src/
    │       ├── index.ts         # Server entry point
    │       ├── db/              # Prisma client
    │       ├── routes/          # API endpoints
    │       ├── middleware/      # CORS, auth, validation
    │       └── utils/           # Helper functions
    ├── frontend/                 # Web Components app
    │   ├── build.js             # esbuild bundler config
    │   ├── public/
    │   │   ├── index.html       # SPA entry point
    │   │   └── styles.css       # Global styles
    │   └── src/
    │       ├── app.ts           # Application orchestrator
    │       ├── components/      # Web Components
    │       ├── state/           # Store (observer pattern)
    │       ├── models/          # Domain models
    │       ├── api/             # API client
    │       ├── utils/           # URL state manager, helpers
    │       └── types/           # Frontend-specific types
    └── shared/                   # Shared TypeScript types
        └── src/
            ├── index.ts         # Barrel export
            └── types/           # Common type definitions
```

## Technology Stack

### Backend

| Technology | Purpose | Version |
|------------|---------|---------|
| **Node.js** | Runtime environment | 20.x |
| **TypeScript** | Type-safe development | 5.3+ |
| **Express.js** | Web server framework | 4.18+ |
| **Prisma** | Type-safe ORM | 5.7+ |
| **PostgreSQL** | Production database | 14+ |
| **Zod** | Runtime validation | 3.22+ |
| **JWT** | Authentication tokens | 9.0+ |
| **bcrypt** | Password hashing | 5.1+ |
| **tsx** | TypeScript execution (dev) | 4.7+ |

### Frontend

| Technology | Purpose | Version |
|------------|---------|---------|
| **TypeScript** | Type-safe development | 5.3+ |
| **Web Components** | UI framework (native) | - |
| **esbuild** | Fast bundler | 0.27+ |
| **DOMPurify** | HTML sanitization | 3.3+ |
| **Marked** | Markdown parsing | 17.0+ |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| **Railway** | Production hosting + PostgreSQL |
| **Docker** | Containerization |
| **GitHub Actions** | CI/CD pipeline |
| **pnpm** | Package manager |
| **Turborepo** | Monorepo orchestration |

## Architectural Decisions

Key architectural decisions are documented in Architecture Decision Records (ADRs) in `docs/adr/`. See [ADR README](adr/README.md) for a complete list.

### Core Principles

1. **[ADR-0001](adr/0001-use-web-components.md)**: Use Native Web Components
   - All UI components extend `HTMLElement`
   - Zero framework dependencies
   - Standards-based, browser-native Custom Elements API

2. **[ADR-0002](adr/0002-use-url-as-state-source.md)**: URL as Single Source of Truth
   - All navigation state lives in the URL
   - Path-based routing: `/entities`, `/entries`, `/entities/:slug/entries`
   - Query parameters for panels: `?panel=log-entry&entity=exercise`
   - Enables shareable links, browser history, refresh resilience

3. **[ADR-0004](adr/0004-typescript-without-transpilation.md)**: TypeScript Without Transpilation
   - Target ES2020+ with native ES modules
   - Type-checking only, minimal build step
   - Modern browsers only (Safari 13+, Chrome 64+, Firefox 69+)

4. **[ADR-0005](adr/0005-observer-pattern-for-state.md)**: Observer Pattern for State Management
   - Custom `Store` class implements observer pattern
   - Components subscribe to store changes
   - Store calls `notify()` after mutations
   - Simple, educational, sufficient

### UI/UX Patterns

5. **[ADR-0008](adr/0008-centered-modal-pattern.md)**: Centered Modal Pattern
   - All forms and dialogs use centered modals
   - Scale + fade animations (200ms)
   - Better desktop UX, consistent behavior

6. **[ADR-0011](adr/0011-resize-observer-for-truncation.md)**: ResizeObserver for Dynamic Truncation
   - Monitors entry card dimensions with ResizeObserver API
   - Dynamically updates fade-out gradient
   - Responds to window resize, orientation changes

### Feature Design

7. **[ADR-0009](adr/0009-custom-entity-properties.md)**: Custom Entity Properties System
   - Dynamic, user-defined properties per entity
   - Supports: number, text, url, checkbox, date, time, duration, rating, select
   - Stored as JSON in database

8. **[ADR-0010](adr/0010-url-title-fetching.md)**: Automatic URL Title Fetching
   - Automatically fetches webpage titles for URL values
   - Uses CORS proxy fallback chain
   - Stores title separately for clean display

## Data Model

### Database Schema (PostgreSQL + Prisma)

#### User Model
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  entities  Entity[]
  entries   Entry[]
}
```

#### Entity Model
```prisma
model Entity {
  id         String   @id @default(cuid())
  name       String
  type       String?
  categories String[]
  valueType  String?
  options    Json?
  properties Json?    # Custom properties definition
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  entries    Entry[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Custom Properties Format:**
```typescript
{
  properties: [
    {
      id: "prop-id",
      name: "Duration",
      valueType: "duration",
      required: false
    }
  ]
}
```

#### Entry Model
```prisma
model Entry {
  id                     String   @id @default(cuid())
  entityId               String
  entity                 Entity   @relation(fields: [entityId], references: [id], onDelete: Cascade)
  entityName             String
  value                  String?
  valueDisplay           String?
  notes                  String?
  timestamp              DateTime
  propertyValues         Json?
  propertyValueDisplays  Json?
  images                 String[]
  latitude               Float?
  longitude              Float?
  locationName           String?
  links                  String[]
  linkTitles             Json?
  entryReferences        String[]  # Array of entry IDs
  archived               Boolean  @default(false)
  userId                 String
  user                   User     @relation(fields: [userId], references: [id])
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
}
```

**Property Values Format:**
```typescript
{
  propertyValues: {
    "prop-id-1": "30",
    "prop-id-2": "https://example.com"
  },
  propertyValueDisplays: {
    "prop-id-2": "Example Website"
  }
}
```

## Frontend Architecture

### Component Hierarchy

```
┌─────────────────────────────────────────┐
│              app.ts                      │
│    (Application Orchestrator)            │
└─────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    │               │               │
┌───▼────┐    ┌────▼────┐    ┌────▼────┐
│ Tabs   │    │ Lists   │    │ Forms   │
└────────┘    └─────────┘    └─────────┘
                    │
        ┌───────────┼───────────┐
        │                       │
┌───────▼──────┐    ┌──────────▼────────┐
│ EntityList   │    │ EntryList         │
│ Component    │    │ Component         │
└──────────────┘    └───────────────────┘
```

### Base WebComponent Class

All components extend a base `WebComponent` class:

```typescript
abstract class WebComponent extends HTMLElement {
  protected store: Store;

  connectedCallback() {
    // Subscribe to store changes
    this.store.subscribe(() => this.render());
  }

  disconnectedCallback() {
    // Unsubscribe from store
    this.unsubscribe();
  }

  abstract render(): void;
}
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `EntityListComponent` | Grid view of entities with color-coded cards |
| `EntryListComponent` | List view of entries with ResizeObserver truncation |
| `EntryDetailComponent` | Single entry detail page with all metadata |
| `EntityCreateFormComponent` | Create new entities with custom properties |
| `EntityEditFormComponent` | Edit existing entities |
| `EntryCreateFormComponent` | Log new entries with rich content |
| `EntryEditFormComponent` | Edit existing entries |
| `ModalPanel` | Centered modal container for forms |
| `AuthComponent` | Login/registration forms |
| `AppTabs` | Navigation tabs (entities/entries) |

### State Management

#### Store (Observer Pattern)

```typescript
class Store {
  private entities: Entity[] = [];
  private entries: Entry[] = [];
  private subscribers: Set<() => void> = new Set();

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify(): void {
    this.subscribers.forEach(callback => callback());
  }

  async addEntry(entry: Entry): Promise<Entry> {
    const created = await APIClient.createEntry(entry);
    this.entries.push(created);
    this.notify();
    return created;
  }
}
```

**Benefits:**
- Simple, predictable state updates
- Automatic UI synchronization
- Easy to debug and test
- No external dependencies

#### URL State Manager

Manages navigation state via URL:

```typescript
class URLStateManager {
  static showEntityList(): void {
    window.history.pushState({}, '', '/entities');
  }

  static showEntityEntries(entityName: string): void {
    const slug = this.slugify(entityName);
    window.history.pushState({}, '', `/entities/${slug}/entries`);
  }

  static openLogEntryPanel(entityName: string): void {
    const params = new URLSearchParams(window.location.search);
    params.set('panel', 'log-entry');
    params.set('entity', entityName);
    window.history.pushState({}, '', `?${params}`);
  }
}
```

### Routing Flow

```
User Action
    ↓
URL Changes (pushState)
    ↓
popstate Event
    ↓
URLStateManager Detects Change
    ↓
app.ts Updates View
    ↓
Components Render from Store
    ↓
User Sees Updated UI
```

## Backend Architecture

### Express Server Structure

```typescript
// packages/backend/src/index.ts
import express from 'express';
import { authRoutes } from './routes/auth.js';
import { entityRoutes } from './routes/entities.js';
import { entryRoutes } from './routes/entries.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/entities', authenticate, entityRoutes);
app.use('/api/entries', authenticate, entryRoutes);

// Static Files (Frontend)
app.use(express.static('../frontend/public'));

// SPA Fallback
app.get('*', (req, res) => {
  res.sendFile('index.html');
});
```

### Middleware Stack

```
Request
    ↓
CORS Middleware
    ↓
Body Parser (JSON, 10MB limit)
    ↓
Route Handler
    ↓
Authentication Middleware (JWT)
    ↓
Validation Middleware (Zod)
    ↓
Controller Logic
    ↓
Prisma Database Query
    ↓
Response
```

### Route Structure

```
/api/auth
  POST /register    - Create new user account
  POST /login       - Authenticate and get JWT token

/api/entities
  GET    /          - List user's entities
  GET    /:id       - Get single entity
  POST   /          - Create new entity
  PUT    /:id       - Update entity
  DELETE /:id       - Delete entity (cascade entries)

/api/entries
  GET    /          - List entries (query: entityId, sortBy, includeArchived)
  GET    /:id       - Get single entry
  POST   /          - Create new entry
  PUT    /:id       - Update entry
  DELETE /:id       - Delete entry
```

## API Design

### Request/Response Format

All API responses follow a consistent format:

**Success Response:**
```json
{
  "id": "entry-id",
  "entityId": "entity-id",
  "entityName": "Morning Run",
  "value": "5.2",
  "notes": "Felt great!",
  "timestamp": "2026-01-09T08:00:00Z",
  "createdAt": "2026-01-09T08:05:00Z"
}
```

**Error Response:**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "entityId",
      "message": "Entity ID is required"
    }
  ]
}
```

### API Client (Frontend)

```typescript
class APIClient {
  private static baseURL = 'https://trackly.railway.app';
  private static token: string | null = localStorage.getItem('token');

  static async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options?.headers
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      this.clearToken();
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    return response.json();
  }

  static async createEntry(entry: Entry): Promise<Entry> {
    return this.request('/api/entries', {
      method: 'POST',
      body: JSON.stringify(entry)
    });
  }
}
```

## Authentication & Authorization

### JWT Token Flow

```
1. User logs in with email + password
2. Backend validates credentials (bcrypt)
3. Backend generates JWT token (signed with JWT_SECRET)
4. Frontend stores token in localStorage
5. All subsequent API requests include token in Authorization header
6. Backend verifies token and extracts userId
7. Database queries filtered by userId
```

### Authentication Middleware

```typescript
export function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

### User Data Isolation

All queries automatically filter by userId:

```typescript
// Example: Get user's entities
const entities = await prisma.entity.findMany({
  where: { userId: req.userId }
});

// Example: Update entry (verify ownership)
const entry = await prisma.entry.update({
  where: {
    id: req.params.id,
    userId: req.userId  // Ensures user owns this entry
  },
  data: updateData
});
```

## Data Flow

### Example: Creating an Entry

```
┌─────────────┐
│   User      │
│ Fills Form  │
└──────┬──────┘
       │
       ▼
┌──────────────────────────┐
│ EntryCreateFormComponent │
│ handleSubmit()           │
└──────┬───────────────────┘
       │
       ▼
┌──────────────┐
│    Store     │
│ addEntry()   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  APIClient   │
│ POST /entries│
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Backend          │
│ 1. Validate      │
│ 2. Create in DB  │
│ 3. Return entry  │
└──────┬───────────┘
       │
       ▼
┌──────────────┐
│    Store     │
│ 1. Add entry │
│ 2. notify()  │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ All Subscribers  │
│ (Components)     │
│ Re-render        │
└──────────────────┘
```

### Example: URL Title Fetching

```
1. User enters URL in form
2. Frontend detects URL pattern
3. Async fetch via CORS proxy (corsproxy.io)
4. Parse HTML for <title> tag
5. If fails, try next proxy (allorigins.win)
6. If fails, use hostname as fallback
7. Store title in linkTitles or propertyValueDisplays
8. Update entry via API
9. Store updates and notifies
10. UI shows title instead of raw URL
```

## Build & Deployment

### Development

```bash
# Install dependencies
pnpm install

# Start backend (localhost:3000)
pnpm --filter @trackly/backend dev

# Build frontend (watch mode)
pnpm --filter @trackly/frontend dev

# Run database migrations
pnpm --filter @trackly/backend db:migrate

# Open Prisma Studio
pnpm --filter @trackly/backend db:studio
```

### Production Build

```bash
# Build all packages with Turbo
pnpm build

# Output:
# - packages/backend/dist/      (Compiled TypeScript)
# - packages/frontend/public/dist/  (Bundled app.js)
# - packages/shared/dist/       (Compiled types)
```

### Docker Deployment

**Multi-stage Dockerfile:**

```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder
RUN npm install -g pnpm@8.12.0
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @trackly/backend run db:generate
RUN pnpm run build

# Stage 2: Production
FROM node:20-alpine
RUN apk add --no-cache openssl
RUN npm install -g pnpm@8.12.0
WORKDIR /app
COPY --from=builder /app/packages/backend/dist ./backend
COPY --from=builder /app/packages/frontend/public ./frontend
COPY --from=builder /app/packages/backend/node_modules ./backend/node_modules
COPY --from=builder /app/packages/backend/prisma ./backend/prisma
CMD cd backend && pnpm run db:migrate && node index.js
```

### Railway Deployment

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string (auto-provisioned)
- `JWT_SECRET` - Secret key for JWT signing
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (production)

**Deployment Trigger:**
- Auto-deploy on push to `main` branch
- Runs Prisma migrations on startup
- Serves frontend static files
- API available at `/api/*`

## Security

### Authentication
- JWT tokens with expiration (90 days default)
- bcrypt password hashing (10 salt rounds)
- Tokens stored in localStorage (frontend)
- Authorization header on all authenticated requests

### Authorization
- All database queries filtered by userId
- Ownership verification on updates/deletes
- User data isolation (multi-tenant architecture)

### Input Validation
- Zod schemas validate all request bodies
- Type-safe with TypeScript
- Sanitize HTML with DOMPurify (frontend)
- Escape HTML in all user-generated content

### API Security
- CORS middleware (configured origins)
- Rate limiting (future enhancement)
- HTTPS in production (Railway)
- Content Security Policy headers (future enhancement)

### Data Protection
- Passwords never stored in plain text
- JWT tokens signed and verified
- No sensitive data in URLs
- Environment variables for secrets

## Performance Considerations

### Frontend Optimizations
- Single bundled JavaScript file (esbuild)
- ResizeObserver for efficient UI updates
- Lazy rendering (only visible entries)
- Debounced search/filter operations
- Event delegation where possible

### Backend Optimizations
- PostgreSQL indexes on common queries
- Efficient Prisma queries (select only needed fields)
- JSON fields for flexible schema
- Cascade deletes (database-level)

### Future Enhancements
- CDN for static assets
- Image compression before upload
- Virtual scrolling for long lists
- Service worker for offline support
- Database connection pooling
- Redis caching layer

---

## Related Documentation

- [Architecture Decision Records](adr/README.md) - Detailed ADRs for all major decisions
- [Lessons Learned](lessons/README.md) - Development lessons and best practices
- [UI Design](UI_DESIGN.md) - UI/UX design principles
- [Concept Design](CONCEPT_DESIGN.md) - Original product concept

## Contributing

When making architectural changes:
1. Create an ADR in `docs/adr/`
2. Update this ARCHITECTURE.md
3. Document lessons learned if applicable
4. Update related code comments
