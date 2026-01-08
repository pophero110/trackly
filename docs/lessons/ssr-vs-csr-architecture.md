# SSR vs CSR: Understanding Trackly's Architecture

**Date:** 2025-01-08
**Category:** Architecture, Education
**Summary:** Explanation of how Trackly's current Client-Side Rendering (CSR) architecture works, and comparison with Server-Side Rendering (SSR).

---

## Current Architecture: Client-Side Rendered SPA

Trackly is a **Client-Side Rendered (CSR) Single Page Application**, not Server-Side Rendered (SSR).

### What We Have

```
┌─────────────────────────────────────────────────┐
│           Express.js Backend                     │
│           (packages/backend)                     │
├─────────────────────────────────────────────────┤
│  1. API Routes:                                  │
│     /api/auth/*     → Authentication             │
│     /api/entities/* → Entity CRUD                │
│     /api/entries/*  → Entry CRUD                 │
│                                                  │
│  2. Static File Serving:                         │
│     /               → frontend/public/*          │
│     /dist/*         → frontend/dist/*            │
│                                                  │
│  3. SPA Fallback (catch-all):                    │
│     *               → index.html (always same!)  │
└─────────────────────────────────────────────────┘
```

### How It Works

**Backend Setup:** `packages/backend/src/index.ts:20-45`

```typescript
// Serve static files
const frontendPublicPath = path.join(__dirname, '../../frontend/public');
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPublicPath));
app.use('/dist', express.static(frontendDistPath));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/entries', entryRoutes);

// SPA fallback - serve index.html for all non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendPublicPath, 'index.html'));
});
```

### Request Flow

```
User visits /entries/abc123
    ↓
Express catches request (catch-all route)
    ↓
Server responds with static index.html (SAME for all routes)
    ↓
Browser loads HTML which includes:
    - <link rel="stylesheet" href="/styles.css">
    - <script type="module" src="/dist/app.js"></script>
    ↓
Client-side JavaScript (app.js) takes over:
    - Reads URL pathname
    - Initializes Web Components
    - Fetches data from /api/* endpoints
    - Renders appropriate view client-side
    ↓
User sees the page
```

---

## CSR vs SSR Comparison

### Client-Side Rendering (Current)

**What the server sends:**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Trackly</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <!-- Empty shell -->
    <div class="container">
        <entity-list></entity-list>
        <entry-list style="display: none;"></entry-list>
    </div>
    <script type="module" src="/dist/app.js"></script>
</body>
</html>
```

**Browser then:**
1. Downloads JavaScript
2. Executes JavaScript
3. Fetches data from API
4. Renders content
5. User sees page

### Server-Side Rendering (Not Implemented)

**What the server would send:**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Entry: Buy Groceries - Trackly</title>
</head>
<body>
    <!-- Pre-rendered content -->
    <div class="container">
        <div class="entry-detail">
            <h1>Buy Groceries</h1>
            <p>2025-01-08</p>
            <div class="notes">Buy milk, eggs, bread</div>
        </div>
    </div>
    <script type="module" src="/dist/app.js"></script>
    <!-- JavaScript "hydrates" the pre-rendered HTML -->
</body>
</html>
```

**Browser then:**
1. Shows content immediately (already rendered!)
2. Downloads JavaScript
3. "Hydrates" (attaches event listeners to existing HTML)
4. User can interact

---

## Comparison Table

| Aspect | CSR (Current) | SSR |
|--------|---------------|-----|
| **Initial HTML** | Empty shell | Pre-rendered content |
| **First Paint** | Slower (wait for JS) | Faster (HTML ready) |
| **Time to Interactive** | Slower | Slower (still needs JS) |
| **SEO** | Poor (crawlers see empty HTML) | Excellent (crawlers see content) |
| **Server Load** | Low (just static files) | High (render on each request) |
| **Deployment** | Simple (static + API) | Complex (Node.js server) |
| **Routing** | Client-side (JS) | Can be both |
| **Data Fetching** | Client-side only | Can be server-side |
| **Bundle Size** | Smaller (no SSR overhead) | Larger (hydration code) |

---

## Why CSR for Trackly?

### Advantages

1. **Simple Deployment**
   - Static files + API server
   - Can use CDN for frontend
   - Easy to scale horizontally

2. **Clear Separation**
   - Backend = API only
   - Frontend = UI only
   - Easy to reason about

3. **Fast Client Navigation**
   - No full page reloads
   - Smooth transitions
   - Better UX after initial load

4. **Development Speed**
   - Faster development cycle
   - Live reload during dev
   - No server restart needed

### Trade-offs

1. **Slower Initial Load**
   - Must download JS before rendering
   - Blank screen while loading
   - Not ideal for public marketing pages

2. **Poor SEO**
   - Search engines see empty HTML
   - Not good for content discovery
   - OK for authenticated apps

3. **Requires JavaScript**
   - Won't work if JS disabled
   - Not accessible in all contexts

4. **Larger Bundle**
   - Must ship all routing logic
   - All data fetching client-side
   - Larger initial download

---

## Build Process

**Frontend Build:** `packages/frontend/build.js`

```javascript
await esbuild.build({
  entryPoints: ['src/app.ts'],
  bundle: true,
  outfile: 'public/dist/app.js',  // Single bundle
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
});
```

Creates a single JavaScript bundle with:
- All Web Components
- State management (Store)
- URL routing logic
- API client
- Utilities

**No SSR compilation:**
- No per-route HTML generation
- No server-side rendering logic
- No hydration code

---

## Client-Side Routing

**URL State Management:** `packages/frontend/src/app.ts:77-236`

```typescript
const updateView = () => {
    const path = window.location.pathname;

    // Client-side routing by parsing pathname
    if (path === '/entities') {
        // Show entity grid
        entityGrid.style.display = 'block';
        entryList.style.display = 'none';
    } else if (path.match(/^\/entries\/([^/]+)$/)) {
        // Show entry detail
        entryDetail.style.display = 'block';
        // Fetch data from API
    }
};

// Listen to URL changes (back/forward buttons)
window.addEventListener('popstate', () => {
    updateView();
});
```

All routing happens **in the browser**:
- Parse `window.location.pathname`
- Show/hide Web Components
- Fetch data from `/api/*`
- Render content

---

## Data Flow

### CSR (Current)

```
Page Load
  ↓
HTML arrives (empty)
  ↓
JavaScript downloads
  ↓
JavaScript executes
  ↓
Store initialized
  ↓
API call: GET /api/entries
  ↓
Data arrives
  ↓
Components render with data
  ↓
User sees content
```

**Time to Content:** ~1-2 seconds

### SSR (If Implemented)

```
Page Load
  ↓
Server fetches data
  ↓
Server renders HTML with data
  ↓
HTML arrives (with content!)
  ↓
User sees content ← FAST!
  ↓
JavaScript downloads
  ↓
JavaScript "hydrates"
  ↓
User can interact
```

**Time to Content:** ~200-500ms

---

## When to Consider SSR?

### Good Use Cases for SSR

1. **Public Content**
   - Blog posts
   - Marketing pages
   - Documentation
   - Landing pages

2. **SEO Critical**
   - E-commerce product pages
   - News articles
   - Public profiles

3. **Fast First Paint Required**
   - Mobile users on slow networks
   - High bounce rate concerns

### Good Use Cases for CSR (Trackly)

1. **Authenticated Apps** ✅
   - No SEO needed
   - Users expect some load time
   - Trackly is user-specific

2. **Interactive Apps** ✅
   - Lots of client-side state
   - Real-time updates
   - Dashboard/tool UIs

3. **Simple Deployment** ✅
   - Static hosting
   - CDN-friendly
   - Easy to scale

---

## Migration Considerations

If we wanted to add SSR in the future, options include:

### 1. Next.js (React Framework)
- Complete rewrite to React
- Built-in SSR support
- File-based routing

### 2. Astro + Web Components
- Keep Web Components
- Add SSR capability
- Partial hydration

### 3. Custom Express SSR
- Keep current stack
- Add rendering logic
- Most control, most work

**See:** `/docs/SSR_MIGRATION_PLAN.md` for detailed migration strategies

---

## Key Takeaways

1. **Trackly is CSR, not SSR**
   - Empty HTML shell served for all routes
   - JavaScript handles routing and rendering
   - Data fetched client-side from API

2. **CSR is appropriate for Trackly**
   - Authenticated app (no SEO needed)
   - Interactive tool (client-side state)
   - Simple deployment

3. **Trade-offs are acceptable**
   - Slower initial load OK for authenticated app
   - No SEO needed for private data
   - Better client-side performance after load

4. **No API calls on re-render**
   - Store caches data in memory
   - Components read from cache
   - Re-renders only manipulate DOM

---

## Related Documents

- `/docs/ARCHITECTURE.md` - Overall system architecture
- `/docs/SSR_MIGRATION_PLAN.md` - SSR migration strategies
- `/docs/lessons/re-render-side-effects.md` - Re-render behavior

---

**Last Updated:** 2025-01-08
