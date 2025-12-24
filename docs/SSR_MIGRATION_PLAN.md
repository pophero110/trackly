# Server-Side Rendering (SSR) Migration Plan

## Current State Analysis

**Architecture**: Client-Side Rendered (CSR) SPA
- **Framework**: Vanilla Web Components (no framework)
- **Data**: LocalStorage (client-only)
- **Routing**: URL state parameters (custom implementation)
- **Server**: Static file serving (Nginx)
- **Build**: TypeScript → ES2020 modules

**Key Characteristics**:
- Zero external framework dependencies
- ~5,000 lines of TypeScript
- Mobile-first responsive design
- Local-first data persistence

---

## SSR Migration Options

### Option 1: Next.js (React) - **RECOMMENDED**

**Approach**: Rewrite components from Web Components to React

**Pros**:
- Industry-standard SSR framework
- Built-in routing, API routes, middleware
- Excellent TypeScript support
- Zero-config SSR/SSG
- Edge runtime support
- Large ecosystem and community
- Can incrementally adopt (pages router)

**Cons**:
- Complete component rewrite required
- Different mental model (React vs Web Components)
- Larger bundle size than current
- Framework lock-in

**Effort**: 🔴 High (3-4 weeks full rewrite)

**Tech Stack**:
```
Next.js 14+ (App Router)
React 18+ (Server Components)
TypeScript
PostgreSQL or SQLite (backend storage)
Prisma or Drizzle (ORM)
TailwindCSS (styling migration)
```

---

### Option 2: SvelteKit - **LIGHTWEIGHT ALTERNATIVE**

**Approach**: Rewrite to Svelte components with SvelteKit SSR

**Pros**:
- Similar component structure to Web Components
- Excellent SSR/SSG support
- Smaller bundle sizes
- Built-in routing and API routes
- TypeScript native
- Reactive by default (similar to current store pattern)

**Cons**:
- Smaller ecosystem than React
- Component rewrite still required
- Less enterprise adoption

**Effort**: 🟡 Medium-High (2-3 weeks)

**Tech Stack**:
```
SvelteKit 2+
Svelte 4+
TypeScript
PostgreSQL/SQLite
Drizzle ORM
Native CSS or TailwindCSS
```

---

### Option 3: Astro with Islands - **HYBRID APPROACH**

**Approach**: Mostly static with interactive islands

**Pros**:
- Can keep Web Components for interactive parts
- Minimal JavaScript by default
- Excellent performance
- Multi-framework support (use React/Svelte/Vue for specific components)
- Simple API routes

**Cons**:
- Not full SSR (more SSG + hydration)
- Limited real-time capabilities
- Routing less mature than Next.js

**Effort**: 🟢 Low-Medium (1-2 weeks)

**Tech Stack**:
```
Astro 4+
Web Components (keep existing)
TypeScript
PostgreSQL/SQLite
Simple REST API
```

---

### Option 4: Remix - **MODERN WEB STANDARDS**

**Approach**: React-based SSR with focus on web standards

**Pros**:
- Built on Web Fetch API
- Excellent form handling (progressive enhancement)
- Fast page transitions
- TypeScript native
- Edge-ready

**Cons**:
- Smaller ecosystem than Next.js
- Complete rewrite needed
- Learning curve for loader/action pattern

**Effort**: 🔴 High (3-4 weeks)

---

### Option 5: Enhance (Custom SSR) - **KEEP WEB COMPONENTS**

**Approach**: Custom Node.js SSR server that pre-renders Web Components

**Pros**:
- Keep existing Web Components
- Full control over SSR process
- Minimal dependency changes

**Cons**:
- Web Components SSR is experimental/complex
- Need to build custom SSR infrastructure
- Limited tooling and support
- Declarative Shadow DOM complexity

**Effort**: 🔴 Very High (4-6 weeks) + ongoing maintenance

---

## Recommended Approach: **Next.js (Option 1)**

### Why Next.js?

1. **Battle-tested**: Used by thousands of production apps
2. **Full-stack**: API routes eliminate need for separate backend
3. **Deployment**: Excellent Vercel/Railway support
4. **Performance**: Server Components, streaming, RSC
5. **Developer Experience**: Fast Refresh, TypeScript, debugging
6. **Future-proof**: Active development, strong community

---

## Migration Architecture

### Data Layer Changes

**Current**: LocalStorage (client-only)
```
Browser → LocalStorage → Store → Components
```

**Target**: Database + API
```
Browser → API Routes → Database → Server Components
         ↓
    Client Components (hydration)
```

**Database Options**:

| Database | Pros | Cons | Use Case |
|----------|------|------|----------|
| **PostgreSQL** | Robust, scalable, free tier (Supabase/Neon) | Overkill for personal use | Multi-user, production |
| **SQLite** | Simple, file-based, zero config | No multi-server support | Personal use, single user |
| **Turso** | Distributed SQLite, edge-ready | New/less mature | Edge deployments |
| **Prisma + Postgres** | Type-safe ORM, migrations | Extra layer | Recommended |

**Recommended**: Prisma + PostgreSQL (Neon free tier)

---

### Schema Design

```prisma
// schema.prisma
model Entity {
  id          String   @id @default(cuid())
  name        String
  type        String
  categories  String[]
  valueType   String?
  options     Json?
  properties  Json?
  createdAt   DateTime @default(now())
  entries     Entry[]
  userId      String
  user        User     @relation(fields: [userId], references: [id])
}

model Entry {
  id                    String   @id @default(cuid())
  entityId              String
  entity                Entity   @relation(fields: [entityId], references: [id])
  timestamp             DateTime
  value                 String?
  valueDisplay          String?
  notes                 String?
  images                String[]
  propertyValues        Json?
  propertyValueDisplays Json?
  createdAt             DateTime @default(now())
  userId                String
  user                  User     @relation(fields: [userId], references: [id])
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  entities  Entity[]
  entries   Entry[]
}
```

---

### Component Migration Strategy

**Current Structure**:
```typescript
// Web Component
class EntityGridComponent extends WebComponent {
  connectedCallback() {
    this.unsubscribe = this.store.subscribe(() => this.render());
    this.render();
  }

  render() {
    this.innerHTML = `<div>...</div>`;
  }
}
```

**Next.js Equivalent**:
```tsx
// Server Component (default)
async function EntityGrid() {
  const entities = await db.entity.findMany();

  return (
    <div className="entities-grid">
      {entities.map(entity => (
        <EntityCard key={entity.id} entity={entity} />
      ))}
    </div>
  );
}

// Client Component (for interactions)
'use client'
function EntityCard({ entity }: { entity: Entity }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div onClick={() => router.push(`/entries?entity=${entity.name}`)}>
      <h3>{entity.name}</h3>
      <ContextMenu open={menuOpen} onToggle={setMenuOpen} />
    </div>
  );
}
```

**Migration Mapping**:

| Current Component | Next.js Strategy |
|------------------|------------------|
| `EntityGridComponent` | Server Component (static list) + Client (interactions) |
| `EntryListComponent` | Server Component (entries) + Client (filters) |
| `EntityFormComponent` | Client Component (forms are interactive) |
| `EntryFormComponent` | Client Component + Server Action |
| `SlideUpPanel` | Client Component (modal) |
| `URLStateManager` | Next.js Router (`useRouter`, `searchParams`) |
| `Store` | Server state (database) + Client state (React Context/Zustand) |

---

### Routing Changes

**Current**: URL query parameters
```
/?view=entries&entity=Habits
/?panel=create-entity
/?entity=Books&panel=log-entry
```

**Next.js App Router**:
```
/                          # Home (entity grid)
/entries?entity=Habits     # Entries list
/entities/new              # Create entity (modal/page)
/entities/[id]/edit        # Edit entity
/entries/new?entity=Books  # New entry for Books
/entries/[id]/edit         # Edit entry
```

**Benefits**:
- Clean URLs
- Built-in prefetching
- Type-safe routing (with `next-intl` or typed routes)
- Middleware support for auth

---

## Migration Path (Incremental)

### Phase 1: Foundation (Week 1)
- [ ] Set up Next.js 14 project with App Router
- [ ] Configure TypeScript
- [ ] Set up Prisma + PostgreSQL (Neon)
- [ ] Migrate data models to Prisma schema
- [ ] Create database seed script (convert localStorage data)
- [ ] Set up TailwindCSS (port CSS variables)

### Phase 2: Core Pages (Week 2)
- [ ] Build entity grid page (Server Component)
- [ ] Build entries list page (Server Component)
- [ ] Implement routing (entities/entries)
- [ ] Create layout with header
- [ ] Port responsive styles

### Phase 3: Forms & Mutations (Week 2-3)
- [ ] Create entity form (Client Component)
- [ ] Create entry form (Client Component)
- [ ] Implement Server Actions for mutations
- [ ] Add form validation (Zod)
- [ ] Image upload handling (S3/Cloudinary or base64)

### Phase 4: Advanced Features (Week 3)
- [ ] Context menus (Client Components)
- [ ] Hashtag filtering
- [ ] Markdown link rendering
- [ ] URL metadata fetching (Server Action)
- [ ] Property management
- [ ] Zen mode editor

### Phase 5: Polish & Deploy (Week 4)
- [ ] Error handling and loading states
- [ ] Optimistic updates
- [ ] Add authentication (NextAuth.js)
- [ ] Performance optimization
- [ ] Deploy to Railway/Vercel
- [ ] Data migration tool for existing users

---

## File Structure (Next.js)

```
trackly-nextjs/
├── app/
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Home (entity grid)
│   ├── entries/
│   │   ├── page.tsx              # Entries list
│   │   ├── new/
│   │   │   └── page.tsx          # New entry form
│   │   └── [id]/
│   │       └── edit/
│   │           └── page.tsx      # Edit entry
│   ├── entities/
│   │   ├── new/
│   │   │   └── page.tsx          # New entity
│   │   └── [id]/
│   │       └── edit/
│   │           └── page.tsx      # Edit entity
│   └── api/                       # API routes (if needed)
├── components/
│   ├── entities/
│   │   ├── EntityCard.tsx
│   │   ├── EntityGrid.tsx
│   │   └── EntityForm.tsx
│   ├── entries/
│   │   ├── EntryCard.tsx
│   │   ├── EntryList.tsx
│   │   └── EntryForm.tsx
│   └── ui/
│       ├── ContextMenu.tsx
│       ├── Modal.tsx
│       └── ZenEditor.tsx
├── lib/
│   ├── db.ts                      # Prisma client
│   ├── actions.ts                 # Server Actions
│   └── utils.ts                   # Helpers
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
└── types/
    └── index.ts
```

---

## Key Technical Decisions

### 1. Server vs Client Components

**Server Components** (default):
- Entity grid display
- Entry list display
- Static content rendering
- Initial data fetching

**Client Components** (`'use client'`):
- Forms (entity form, entry form)
- Context menus
- Modals/panels
- Interactive filters
- Zen mode editor

### 2. Data Fetching

**Server Components**:
```tsx
async function EntitiesPage() {
  const entities = await db.entity.findMany({
    include: { entries: true }
  });

  return <EntityGrid entities={entities} />;
}
```

**Client Components** (when needed):
```tsx
'use client'
function EntryList({ entityId }: { entityId: string }) {
  const { data, isLoading } = useSWR(
    `/api/entries?entityId=${entityId}`,
    fetcher
  );

  if (isLoading) return <Skeleton />;
  return <div>{data.map(entry => <EntryCard entry={entry} />)}</div>;
}
```

### 3. Mutations

**Server Actions** (recommended):
```tsx
// app/actions/entities.ts
'use server'
export async function createEntity(formData: FormData) {
  const name = formData.get('name') as string;
  const type = formData.get('type') as string;

  const entity = await db.entity.create({
    data: { name, type, userId: session.user.id }
  });

  revalidatePath('/');
  return { success: true, entity };
}

// In component:
'use client'
function EntityForm() {
  const [state, formAction] = useFormState(createEntity, null);

  return (
    <form action={formAction}>
      <input name="name" />
      <button type="submit">Create</button>
    </form>
  );
}
```

### 4. Authentication

**NextAuth.js**:
```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: 'jwt' },
};

export const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

---

## Performance Considerations

### Bundle Size Comparison

**Current (CSR)**:
- Initial load: ~632 KB (dist/ folder)
- Runtime: All code downloaded upfront
- Hydration: N/A

**Next.js (SSR)**:
- Initial HTML: ~10-20 KB (server-rendered)
- JavaScript: ~200-300 KB (framework + app code)
- Hydration: ~50-100ms
- Route prefetching: Faster navigation

### Optimization Strategies

1. **Server Components**: Reduce client-side JavaScript
2. **Code splitting**: Automatic per-route
3. **Image optimization**: `next/image` component
4. **Font optimization**: `next/font` local fonts
5. **Streaming**: Progressive rendering with Suspense
6. **Static generation**: Pre-render entity grid at build time

---

## SEO Improvements

**Current (CSR)**:
```html
<!-- Crawlers see empty shell -->
<body>
  <div class="container">
    <entity-grid></entity-grid>
  </div>
  <script src="app.js"></script>
</body>
```

**Next.js (SSR)**:
```html
<!-- Crawlers see full content -->
<body>
  <div class="container">
    <h1>Trackly - Personal Tracking</h1>
    <div class="entities-grid">
      <div class="entity-card">
        <h3>Habits</h3>
        <span>15 entries</span>
      </div>
      <!-- ... more entities -->
    </div>
  </div>
  <script>/* hydration code */</script>
</body>
```

**Benefits**:
- Instant first paint
- Better Google indexing
- Social media previews (Open Graph)
- Accessibility improvements

---

## Deployment Strategy

### Current Deployment (Nginx)
```
Railway → Docker build → Nginx → Static files
```

### Next.js Deployment Options

**Option A: Vercel (Recommended)**
```
GitHub → Vercel (auto-deploy)
- Zero config
- Edge functions
- Image optimization
- Analytics
- Free tier sufficient
```

**Option B: Railway**
```
GitHub → Railway → Next.js server
- Keep current platform
- Requires Node.js runtime
- Database included
- $5/month minimum
```

**Option C: Self-hosted**
```
Docker → Next.js standalone → PM2/Docker Compose
- Full control
- More complex
- Nginx reverse proxy
```

---

## Risk Assessment

### High Risk Items
- [ ] **Component rewrite**: Complete application rebuild
- [ ] **Data migration**: LocalStorage → Database (user data loss risk)
- [ ] **Auth implementation**: New security surface
- [ ] **Breaking changes**: URLs change, users need to re-learn

### Mitigation Strategies
1. **Parallel deployment**: Keep old CSR version running during migration
2. **Data export tool**: Let users download LocalStorage data
3. **Import wizard**: Upload JSON from old app → migrate to database
4. **Feature parity checklist**: Ensure no feature loss
5. **User communication**: Changelog, migration guide

---

## Alternative: Hybrid Approach (Recommended for Solo Projects)

### Keep CSR + Add Optional SSR Features

**Concept**: Don't do full migration, just add backend API

**Architecture**:
```
Current SPA (Web Components)
    ↓
Add Node.js API (Express/Hono)
    ↓
Add PostgreSQL
    ↓
Sync LocalStorage ↔ Database
```

**Benefits**:
- Keep existing frontend (zero rewrite)
- Add backend for multi-device sync
- Opt-in migration (users choose cloud vs local)
- Lower risk, incremental value

**Effort**: 🟢 Low (1 week for basic API)

**Implementation**:
```typescript
// Add backend API
// server/index.ts
import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

// Sync endpoint
app.post('/api/sync', async (req, res) => {
  const { entities, entries } = req.body;

  // Upsert entities
  for (const entity of entities) {
    await prisma.entity.upsert({
      where: { id: entity.id },
      update: entity,
      create: entity,
    });
  }

  res.json({ success: true });
});

// Current frontend stays the same
// Just add sync button:
// Store.ts
async syncToCloud() {
  const data = {
    entities: this.entities,
    entries: this.entries,
  };

  await fetch('/api/sync', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

---

## Timeline & Effort Estimates

### Full Next.js Migration

| Phase | Duration | Effort | Deliverable |
|-------|----------|--------|-------------|
| Setup & Foundation | 3 days | 🔴 High | Database, project structure |
| Core Pages | 5 days | 🔴 High | Grid, list, routing |
| Forms & Mutations | 5 days | 🔴 High | CRUD operations |
| Advanced Features | 5 days | 🟡 Medium | Hashtags, links, properties |
| Polish & Deploy | 4 days | 🟡 Medium | Auth, optimization, deploy |
| **Total** | **22 days** | **~3-4 weeks** | Production SSR app |

### Hybrid API Approach

| Phase | Duration | Effort | Deliverable |
|-------|----------|--------|-------------|
| Backend API Setup | 2 days | 🟢 Low | Express + Prisma |
| Sync Endpoints | 2 days | 🟢 Low | CRUD APIs |
| Frontend Integration | 2 days | 🟢 Low | Fetch calls |
| Deploy Backend | 1 day | 🟢 Low | Railway/Render |
| **Total** | **7 days** | **~1 week** | Hybrid sync app |

---

## Recommendation Summary

### For Personal Use (Solo Developer)
**Choose**: Hybrid API Approach
- Keep familiar Web Components
- Add backend for multi-device sync
- Low risk, high value
- Can always migrate to full SSR later

### For Production/Portfolio
**Choose**: Next.js Full Migration
- Modern stack
- Better performance
- Impressive for portfolio
- Industry-standard practices

### For Learning Experience
**Choose**: SvelteKit
- Similar to Web Components
- Modern SSR without React overhead
- Great learning opportunity

---

## Next Steps

1. **Decision**: Choose migration approach (Full SSR vs Hybrid)
2. **Prototype**: Build PoC of entity grid in chosen framework
3. **Data export**: Add JSON export from current app
4. **Database setup**: Provision PostgreSQL (Neon/Supabase)
5. **Parallel deployment**: Deploy migration alongside current app
6. **User testing**: Get feedback on new version
7. **Feature parity**: Ensure all features work
8. **Cutover**: Switch DNS/default to new version
9. **Deprecation**: Sunset old CSR app after 3 months

---

## Resources

### Next.js
- [Next.js 14 Docs](https://nextjs.org/docs)
- [Next.js App Router Guide](https://nextjs.org/docs/app)
- [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)

### Database
- [Prisma Docs](https://www.prisma.io/docs)
- [Neon PostgreSQL](https://neon.tech) (free tier)
- [Supabase](https://supabase.com) (PostgreSQL + Auth)

### Deployment
- [Vercel](https://vercel.com) (recommended)
- [Railway](https://railway.app)

### Migration Examples
- [Next.js Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)
- [Web Components → React](https://react.dev/reference/react-dom/components)

---

**Document Version**: 1.0
**Last Updated**: 2025-12-23
**Author**: Claude Code
**Status**: Draft for Review
