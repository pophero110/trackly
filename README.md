# Trackly - Personal Tracking App

A modern full-stack web application for tracking habits, tasks, activities, and more. Built with TypeScript, Express, PostgreSQL, and deployed on Railway.

## Live Demo

🚀 **Production URL**: https://trackly-production.up.railway.app

### Test User Credentials

For testing the live application, you can use:

**Email**: `railwaytest@example.com`
**Password**: `testpass123`
**Name**: Railway Test User

Or create your own account - registration is open!

## Features

- **User Authentication**: Secure JWT-based authentication with bcrypt password hashing
- **Create Entities**: Define trackable items (Habits, Tasks, Moods, etc.) with customizable properties
- **Log Entries**: Record time-series data with notes, values, and images
- **Full CRUD Operations**: Create, read, update, and delete entities and entries
- **PostgreSQL Database**: Production-ready data persistence with Prisma ORM
- **REST API**: Complete RESTful API with request validation
- **Responsive Design**: Modern UI that works on desktop and mobile
- **Multi-User Support**: User isolation with ownership verification

## Architecture

### Monorepo Structure

```
trackly/
├── packages/
│   ├── backend/           # Express REST API
│   │   ├── src/
│   │   │   ├── routes/    # API endpoints
│   │   │   ├── middleware/# Auth & validation
│   │   │   └── db/        # Prisma client
│   │   └── prisma/        # Database schema & migrations
│   ├── frontend/          # TypeScript web app
│   │   ├── src/
│   │   │   ├── api/       # API client
│   │   │   ├── components/# Web components
│   │   │   ├── state/     # State management
│   │   │   └── models/    # Domain models
│   │   └── public/        # Static assets
│   └── shared/            # Shared TypeScript types
└── Dockerfile             # Production deployment
```

### Tech Stack

**Backend:**
- Node.js 20 (Debian-based for Prisma compatibility)
- Express.js - Web framework
- Prisma - Database ORM
- PostgreSQL - Database
- JWT - Authentication tokens
- Zod - Request validation
- bcrypt - Password hashing

**Frontend:**
- TypeScript - Type-safe JavaScript
- Web Components - Reusable UI components
- Vanilla JS - No framework dependencies
- CSS3 - Modern responsive design

**Infrastructure:**
- Railway - Hosting & PostgreSQL database
- PNPM - Package manager
- Turborepo - Monorepo build orchestration
- GitHub Actions - CI/CD (auto-deploy on push to main)

## Quick Start

### Prerequisites

- Node.js 20+
- PNPM 8+
- PostgreSQL (for local development)

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cd packages/backend
cp .env.example .env
# Edit .env and add your DATABASE_URL and JWT_SECRET

# Run database migrations
pnpm exec prisma migrate dev

# Build all packages
cd ../..
pnpm build
```

### Development

```bash
# Start backend dev server (from root)
pnpm --filter @trackly/backend run dev

# In another terminal, start frontend compilation
pnpm --filter @trackly/frontend run dev

# Backend runs on http://localhost:3000
# Frontend served from packages/frontend/public
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - Login and get JWT token

### Entities (Requires Authentication)
- `GET /api/entities` - List all user's entities
- `GET /api/entities/:id` - Get single entity
- `POST /api/entities` - Create new entity
- `PUT /api/entities/:id` - Update entity
- `DELETE /api/entities/:id` - Delete entity (cascade deletes entries)

### Entries (Requires Authentication)
- `GET /api/entries` - List all entries (optional: `?entityId=xxx`)
- `GET /api/entries/:id` - Get single entry
- `POST /api/entries` - Create new entry
- `PUT /api/entries/:id` - Update entry
- `DELETE /api/entries/:id` - Delete entry

### Health Check
- `GET /api/health` - Server status

## Database Schema

**User Table:**
- id (CUID)
- email (unique)
- password (bcrypt hashed)
- name (optional)
- createdAt, updatedAt

**Entity Table:**
- id (CUID)
- name, type, categories
- valueType (optional)
- options (JSONB) - for select options
- properties (JSONB) - custom properties
- userId (foreign key)
- createdAt, updatedAt

**Entry Table:**
- id (CUID)
- entityId (foreign key)
- entityName (denormalized)
- timestamp
- value, valueDisplay
- notes, images
- propertyValues (JSONB)
- userId (foreign key)
- createdAt, updatedAt

## Security Features

✅ JWT authentication with 30-day token expiry
✅ bcrypt password hashing (10 rounds)
✅ Request validation with Zod schemas
✅ User ownership verification on all mutations
✅ CORS middleware configured
✅ Environment-based secrets (JWT_SECRET)

## Deployment

### Railway (Production)

The app auto-deploys to Railway on every push to `main`:

1. **Build**: Multi-stage Docker build with Prisma Client generation
2. **Migrate**: Runs `prisma migrate deploy` if DATABASE_URL is set
3. **Start**: Node.js server on Railway-assigned PORT

**Environment Variables Required:**
- `DATABASE_URL` - PostgreSQL connection string (Railway provides this)
- `JWT_SECRET` - Secret for JWT signing (set in Railway dashboard)
- `NODE_ENV` - Set to "production"

### Manual Deployment

```bash
# Build for production
pnpm build

# Run migrations
cd packages/backend
pnpm exec prisma migrate deploy

# Start production server
NODE_ENV=production node dist/index.js
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Clean build artifacts
pnpm clean

# Run backend dev server
pnpm --filter @trackly/backend run dev

# Run frontend dev build
pnpm --filter @trackly/frontend run dev

# Database commands
cd packages/backend
pnpm exec prisma migrate dev     # Create & apply migration
pnpm exec prisma studio          # Open Prisma Studio GUI
pnpm exec prisma generate        # Regenerate Prisma Client
```

## Entity Types

The app supports 18 different entity types:

- **Habit** - Daily habit tracker
- **Task** - Task status (To Do, In Progress, Done)
- **Mood** - Mood scale slider
- **Node** - General notes
- **Event** - Event with datetime
- **Idea** - Ideas and thoughts
- **Book** - Reading progress
- **Article** - Article URLs
- **Paper** - Research papers
- **Project** - Project hours
- **Concept** - Learning concepts
- **Decision** - Decision tracking
- **Communication** - Communication log
- **Exercise** - Workout duration
- **Metric** - Numeric metrics
- **Activity** - Activity descriptions
- **Goal** - Goal progress
- **Plan** - Plan status

Each entity type has default value types and options configured for optimal tracking.

## Testing

### Local API Testing

```bash
# Health check
curl http://localhost:3000/api/health

# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Production API Testing

Replace `localhost:3000` with `https://trackly-production.up.railway.app` in the above commands.

## Contributing

This is a personal project, but feel free to fork and customize for your own use!

## License

MIT

---

**Built with ❤️ and Claude Code**
