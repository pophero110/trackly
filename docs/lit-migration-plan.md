# Migration Plan: Trackly Frontend to Lit SPA

## Current State Summary
- **Framework**: Vanilla Web Components (Custom Elements API)
- **Build**: ESBuild bundling TypeScript to ES2020
- **Routing**: Custom URL-based routing via `URLStateManager`
- **State**: Observer pattern with central `Store` class
- **Components**: 10+ custom elements extending base `WebComponent` class
- **Rendering**: Manual `innerHTML` with template strings
- **Size**: ~15-40KB per component, moderately complex

---

## Migration Strategy: Incremental Adoption

**Approach**: Gradual migration, component-by-component, maintaining app functionality throughout.

**Why Incremental**:
- Lit works alongside vanilla Web Components
- Can test each migrated component independently
- Reduces risk of breaking the entire app
- Allows learning and pattern refinement during migration

---

## Phase 1: Foundation Setup

### 1.1 Install Lit Dependencies
```bash
pnpm add lit
pnpm add -D @lit/reactive-element @lit/localize-tools
```

### 1.2 Create Lit Base Component
**File**: `src/components/LitBaseComponent.ts`
- Extend `LitElement` instead of `HTMLElement`
- Integrate with existing `Store` subscription pattern
- Provide reactive property decorators
- Maintain Store subscription lifecycle (connect/disconnect)

**Pattern**:
```typescript
import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

export class LitBaseComponent extends LitElement {
  protected store = StoreRegistry.getStore();
  protected unsubscribe?: Unsubscribe;

  connectedCallback() {
    super.connectedCallback();
    this.unsubscribe = this.store.subscribe(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
  }
}
```

### 1.3 Update Build Configuration
**File**: `packages/frontend/build.js`
- Add Lit decorators support (already using TypeScript decorators)
- Ensure ESBuild handles `@customElement`, `@property`, `@state` decorators
- Verify ES2020 target compatibility with Lit

### 1.4 Update TypeScript Configuration
**File**: `packages/frontend/tsconfig.json`
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "useDefineForClassFields": false  // Important for Lit decorators
  }
}
```

---

## Phase 2: Migrate Simple Components First

**Order**: Start with simplest components, build confidence and patterns.

### 2.1 Migrate `AppTabs.ts`
- Simple navigation component
- Good starter to learn Lit patterns
- Uses `@property` for active tab state
- Replace `innerHTML` with `html` template
- Use `@click` directive for event binding

**Before**:
```typescript
class AppTabs extends WebComponent {
  render() {
    this.innerHTML = `<nav>...</nav>`;
  }
}
```

**After**:
```typescript
@customElement('app-tabs')
class AppTabs extends LitBaseComponent {
  @property() activeTab = 'entries';

  render() {
    return html`<nav>...</nav>`;
  }
}
```

### 2.2 Migrate `ModalPanel.ts` and `SlidePanel.ts`
- Wrapper components for dialogs/panels
- Learn Lit slot system for content projection
- Use `@property` for open/close state
- Replace manual DOM event listeners with `@` event syntax

---

## Phase 3: Migrate Form Components

### 3.1 `EntityCreateFormComponent.ts`
- Form with controlled inputs
- Use `@property` for form state
- Lit `@change` and `@input` event handlers
- Form validation with Lit lifecycle

### 3.2 `EntityEditFormComponent.ts`
- Similar to create form
- Pre-populate with entity data
- Two-way binding patterns with Lit

### 3.3 `EntryCreateFormComponent.ts`
- Quick entry form
- Minimal complexity
- Good practice for form patterns

---

## Phase 4: Migrate List/View Components

### 4.1 `EntityListComponent.ts`
- Grid view rendering
- Use `map()` directive for entity list
- `@property` for selected entity
- Lit conditional rendering with `when()` directive

### 4.2 `EntryListComponent.ts` (Most Complex - ~41KB)
- Timeline/list view with sorting, filtering
- Break into smaller sub-components:
  - `EntryListHeader` - filters, sort controls
  - `EntryListItem` - individual entry card
  - `EntryList` - main container
- Use `repeat()` directive with key function for efficient list rendering
- `@state` for local component state (expanded items, etc.)

### 4.3 `EntryDetailComponent.ts`
- Full entry view with editing
- Rich markdown editor integration
- Use Lit directives for conditional edit/view modes
- `@state` for edit mode toggle

---

## Phase 5: Router Integration

### 5.1 Evaluate Router Options

**Option A: Keep Custom URL Router**
- Maintain `URLStateManager` utility
- Integrate with Lit's `requestUpdate()` lifecycle
- Listen to `popstate` events and trigger Lit updates

**Option B: Adopt Lit Router**
```bash
pnpm add @lit-labs/router
```
- Official Lit routing solution
- Replace `URLStateManager` with `@lit-labs/router`
- Use `<router-outlet>` for view switching
- Migrate route definitions to router config

**Recommendation**: Start with Option A (keep URLStateManager), then evaluate Option B if routing becomes complex.

### 5.2 Update App Orchestrator
**File**: `src/app.ts`
- Migrate `TracklyApp` to Lit-based orchestrator
- Use router outlet for view switching
- Maintain URL parameter parsing
- Integrate modal/panel visibility with route state

---

## Phase 6: State Management Enhancement

### 6.1 Evaluate State Management Options

**Option A: Keep Observer Pattern Store**
- Minimal changes to existing `Store.ts`
- Components call `this.requestUpdate()` in subscription callback
- Maintain architecture decision (ADR 0005)

**Option B: Adopt Lit Context API**
```bash
pnpm add @lit/context
```
- Provide/consume pattern for dependency injection
- Replace `StoreRegistry` with `@provide/@consume` decorators
- Better component isolation and testability

**Option C: Adopt State Management Library**
- Options: Pinia (Vue-inspired), MobX-Lit, Redux Toolkit
- Reactive state with decorators
- More powerful for complex state scenarios

**Recommendation**: Start with Option A (keep Store), then move to Option B (Lit Context) for better encapsulation.

### 6.2 Refactor Store for Reactivity
**File**: `src/state/Store.ts`
- Add Lit-specific update notifications
- Provide reactive properties via Context
- Maintain backward compatibility during transition

---

## Phase 7: Styling Strategy

### 7.1 Evaluate CSS Approach

**Option A: Global CSS (Current)**
- Keep `public/styles.css`
- No Shadow DOM encapsulation
- Works with current approach

**Option B: Scoped Styles with Shadow DOM**
```typescript
@customElement('my-component')
class MyComponent extends LitElement {
  static styles = css`
    :host { display: block; }
    button { color: blue; }
  `;
}
```
- Component-scoped CSS
- Shadow DOM encapsulation
- Better component isolation

**Option C: Hybrid Approach**
- Global styles for theme/layout
- Component styles for component-specific styling
- Use `createRenderRoot()` to disable Shadow DOM selectively

**Recommendation**: Start with Option A (global CSS), then gradually adopt Option B for new components.

### 7.2 Create Shared Styles
**File**: `src/styles/shared-styles.ts`
```typescript
import { css } from 'lit';

export const sharedStyles = css`
  /* Common styles for all components */
`;
```

---

## Phase 8: Testing & Validation

### 8.1 Add Component Testing
```bash
pnpm add -D @web/test-runner @open-wc/testing
```
- Set up Web Test Runner
- Write tests for migrated components
- Test Lit lifecycle hooks
- Validate Store integration

### 8.2 End-to-End Testing
- Manual testing of all user flows
- Test routing transitions
- Validate form submissions
- Test modal/panel interactions

### 8.3 Performance Validation
- Compare bundle size before/after
- Measure initial render time
- Test list rendering performance (large entry lists)
- Validate memory usage

---

## Phase 9: Cleanup & Optimization

### 9.1 Remove Old Code
- Delete `WebComponent.ts` base class
- Remove unused utility functions
- Clean up manual DOM manipulation code

### 9.2 Optimize Bundle
- Enable code splitting if needed
- Tree-shake unused Lit features
- Optimize chunk sizes

### 9.3 Update Documentation
- Update ADR 0001 (Web Components) to mention Lit adoption
- Document new component patterns
- Create component development guide
- Update CLAUDE.md with Lit conventions

---

## Migration Checklist

### Prerequisites
- [ ] Install Lit and dependencies
- [ ] Create `LitBaseComponent` base class
- [ ] Update build configuration for decorators
- [ ] Update TypeScript configuration

### Components (in order)
- [ ] `AppTabs.ts` (simplest, navigation)
- [ ] `ModalPanel.ts` (wrapper)
- [ ] `SlidePanel.ts` (wrapper)
- [ ] `EntityCreateFormComponent.ts` (form)
- [ ] `EntityEditFormComponent.ts` (form)
- [ ] `EntryCreateFormComponent.ts` (form)
- [ ] `AuthComponent.ts` (login/register)
- [ ] `EntityListComponent.ts` (list view)
- [ ] `EntryDetailComponent.ts` (detail view)
- [ ] `EntryListComponent.ts` (most complex, break into sub-components)

### Infrastructure
- [ ] Integrate router (keep URLStateManager or adopt Lit Router)
- [ ] Update `app.ts` orchestrator to Lit
- [ ] Refactor Store for Lit reactivity
- [ ] Decide on styling approach (global vs scoped)
- [ ] Add component testing setup

### Validation & Cleanup
- [ ] Test all user flows
- [ ] Validate performance
- [ ] Remove old `WebComponent` code
- [ ] Update documentation
- [ ] Update CLAUDE.md guidelines

---

## Estimated Timeline

- **Phase 1** (Foundation): 1-2 days
- **Phase 2** (Simple components): 2-3 days
- **Phase 3** (Forms): 3-4 days
- **Phase 4** (Lists/Views): 5-7 days
- **Phase 5** (Router): 2-3 days
- **Phase 6** (State): 2-3 days
- **Phase 7** (Styling): 1-2 days
- **Phase 8** (Testing): 3-4 days
- **Phase 9** (Cleanup): 1-2 days

**Total**: 20-31 days (approximately 4-6 weeks)

---

## Risk Mitigation

1. **Breaking Changes**: Migrate incrementally, maintain backward compatibility
2. **State Management Issues**: Keep Store pattern initially, refactor gradually
3. **Routing Complexity**: Start with existing URLStateManager, evaluate alternatives
4. **Performance Regression**: Benchmark before/after, optimize as needed
5. **Team Learning Curve**: Start with simple components, build expertise gradually

---

## Success Criteria

- ✅ All components migrated to Lit
- ✅ All user flows working correctly
- ✅ No performance regression (ideally improved rendering)
- ✅ Bundle size comparable or smaller
- ✅ Code is more maintainable (less manual DOM manipulation)
- ✅ Developer experience improved (better templates, reactivity)
- ✅ Tests passing
- ✅ Documentation updated

---

## Architecture Analysis

### Current Frontend Architecture

**Framework**: Native Web Components (Custom Elements API) - no framework dependencies
- Uses vanilla Web Components extending `HTMLElement`
- All components are registered using `customElements.define()`
- Base class `WebComponent` provides lifecycle and state subscription patterns

**Build System**:
- ESBuild for bundling TypeScript to ES2020 modules
- Single entry point: `src/app.ts` → `public/dist/app.js`
- Target: ES2020 (modern browsers only, no polyfills)
- No transpilation, outputs native ES modules
- Development server: `live-server` for local development

**Key Dependencies**:
```json
"@milkdown/core": "^7.18.0",
"@milkdown/prose": "^7.18.0",
"dompurify": "^3.3.1",
"marked": "^17.0.1"
```
(Markdown editor and parsing utilities, no UI framework libraries)

### Main Entry Points and Routing Setup

**HTML Entry Point**: `/packages/frontend/public/index.html`
- Single HTML file with hardcoded layout structure
- Contains template elements for forms that get cloned dynamically
- Loads JavaScript module: `<script type="module" src="/dist/app.js"></script>`

**Routing System**: URL-based routing using `URLStateManager` utility
- **Path-based routing**:
  - `/` → redirects to `/entries`
  - `/entities` → entity grid view
  - `/entries` → all entries view
  - `/entities/{entitySlug}/entries` → entries for specific entity
  - `/entries/{entryId}` → entry detail in slide-up panel

- **Query parameters for actions**:
  - `?action=log-entry` → open entry creation modal
  - `?action=create-entity` → open entity creation modal
  - `?action=edit-entity&entity={slug}` → open entity edit modal
  - `?action=clone-entity&entity={slug}` → clone entity

- **Additional query params**:
  - `sortBy` and `sortOrder` for sorting entries
  - `tags` for tag filtering (comma-separated)
  - Entity names encoded as URL slugs (lowercase, hyphens for spaces)

**Main App Orchestrator** (`src/app.ts`):
- `TracklyApp` class initializes the app on DOM ready
- Handles view routing based on URL changes
- Manages store registration and component lifecycle
- Sets up navigation event handlers
- Orchestrates visibility of main views (EntityList, EntryList, EntryDetail)

### Component Structure and Patterns

**Component Architecture**:

All components extend `WebComponent` base class which provides:
- Store subscription/unsubscription (observer pattern)
- Auto-render on store changes
- Loading state helper
- Lifecycle hooks: `connectedCallback()`, `disconnectedCallback()`

**Main Components**:
```
src/components/
├── WebComponent.ts          // Base class for all Web Components
├── AppTabs.ts              // (navigation tabs)
├── AuthComponent.ts         // Login/registration screen
├── EntityListComponent.ts   // Grid view of all entities
├── EntityCreateFormComponent.ts  // Create new entity form
├── EntityEditFormComponent.ts    // Edit existing entity form
├── EntryListComponent.ts    // Timeline/list view of entries
├── EntryDetailComponent.ts  // Full entry view with editing
├── ModalPanel.ts           // Centered modal dialog wrapper
└── SlidePanel.ts           // Right-side slide-in panel wrapper
```

**Rendering Pattern**:
- HTML-in-JavaScript (innerHTML/template strings)
- `createTemplate()` helper uses `<template>` element and `DocumentFragment`
- Document fragments for efficient DOM updates
- `replaceChildren()` for atomic updates
- Direct event listener attachment (no event delegation framework)

**State Subscription Example**:
```typescript
connectedCallback(): void {
  this.unsubscribe = this.store.subscribe(() => this.render());
  this.render();
}

disconnectedCallback(): void {
  if (this.unsubscribe) this.unsubscribe();
}
```

**Component Size**: Components are moderately sized (15-40KB):
- EntryListComponent: ~41KB (largest, most complex)
- EntityEditFormComponent: ~28KB
- EntryDetailComponent: ~38KB
- EntityCreateFormComponent: ~18KB

### State Management Approach

**Pattern**: Observer pattern (custom implementation, ADR 0005)
- **Single Store**: Central `Store` class manages all application state
- **No framework**: Pure TypeScript, no Redux/MobX/Pinia

**Store Structure** (`src/state/Store.ts`):
```typescript
class Store {
  // Data collections
  private entities: Entity[]
  private entries: Entry[]

  // State
  private selectedEntityId: string | null
  private isLoaded: boolean

  // Observer pattern
  subscribe(listener: StoreListener): Unsubscribe
  notify(): void
}
```

**Data Models**:
- `Entity` model (`src/models/Entity.ts`) - entities being tracked (activities, categories, etc.)
- `Entry` model (`src/models/Entry.ts`) - individual log entries
- Both have validation and serialization methods

**API Integration**:
- `APIClient` class handles all HTTP requests
- Fetch-based with Bearer token authentication
- Automatic 401 redirect to login
- All data loaded from backend API (no local-only state)

**Global Access**:
- `StoreRegistry` singleton pattern provides access to Store
- Web Components can't receive constructor params, so registry enables global access
- Registry initialized before components are registered

**Data Loading**:
- Initial load in Store constructor calls `loadData()`
- Fetches entities and entries from API
- Optional sort parameters passed to API
- Async operation, components show loading state until `isLoaded = true`

### Key Files and Directories

```
packages/frontend/
├── src/
│   ├── app.ts                    # Main app orchestrator (17KB)
│   ├── api/
│   │   └── client.ts            # API communication layer
│   ├── components/              # Web Components
│   │   ├── WebComponent.ts      # Base class
│   │   ├── *Component.ts        # 10 custom elements
│   │   └── *Panel.ts            # Modal/Slide panels
│   ├── state/
│   │   ├── Store.ts             # Central state management
│   │   └── StoreRegistry.ts     # Global store access
│   ├── models/
│   │   ├── Entity.ts            # Entity data model
│   │   └── Entry.ts             # Entry data model
│   ├── utils/
│   │   ├── urlState.ts          # URL routing state manager
│   │   ├── toast.ts             # Toast notifications
│   │   ├── storage.ts           # LocalStorage utilities
│   │   ├── markdown.ts          # Markdown parsing
│   │   ├── milkdown.ts          # Rich editor integration
│   │   ├── helpers.ts           # General utilities
│   │   └── entryHelpers.ts      # Entry-specific utilities
│   ├── config/
│   │   └── valueTypeConfig.ts   # Entity property type definitions
│   └── types/
│       └── index.ts             # TypeScript type definitions
│
├── public/
│   ├── index.html               # Single HTML entry point
│   ├── styles.css               # All styles (not separate CSS)
│   ├── dist/                    # Build output
│   │   ├── app.js              # Main bundled app
│   │   └── app.js.map          # Source map
│   └── favicon/                 # Icon assets
│
├── build.js                     # ESBuild configuration script
├── package.json                 # Dependencies: esbuild, live-server, TypeScript
└── tsconfig.json               # TypeScript configuration
```

**Architecture Files** (documentation):
- `/docs/adr/0001-use-web-components.md` - Web Components decision
- `/docs/adr/0002-use-url-as-state-source.md` - URL routing approach
- `/docs/adr/0003-entity-names-as-url-identifiers.md` - Entity URL encoding
- `/docs/adr/0004-typescript-without-transpilation.md` - TypeScript + ES2020
- `/docs/adr/0005-observer-pattern-for-state.md` - State management pattern

### Existing Lit Usage or Web Components Patterns

**Current Status**: NO Lit usage whatsoever
- Pure Web Components with standard Custom Elements API
- No template libraries, no reactive properties
- Manual DOM manipulation with innerHTML and DOM APIs

**Web Components Patterns Currently Used**:

1. **Custom Elements Registration**:
   ```typescript
   customElements.define('entity-list', EntityListComponent);
   ```

2. **Lifecycle Methods**:
   - `connectedCallback()` - initialize on insertion into DOM
   - `disconnectedCallback()` - cleanup on removal

3. **Encapsulation**: None - no Shadow DOM used
   - All DOM directly accessible and styleable
   - CSS applies globally

4. **Event Handling**: Direct attachment, no delegation framework
   ```typescript
   this.querySelector('button')?.addEventListener('click', handler);
   ```

5. **State Reactivity**: Manual via Observer pattern
   ```typescript
   unsubscribe = store.subscribe(() => this.render())
   ```

### Migration Considerations for Lit SPA

**Opportunities for Lit**:
- Replace manual `innerHTML` rendering with Lit's `html` template literals
- Use `LitElement` reactive properties instead of manual Store subscription
- Leverage Lit's directive system for conditional rendering, loops, event binding
- Better DOM diffing and performance via Lit's patching algorithm
- Type-safe template rendering

**Challenges to Address**:
- Current Store would need to be refactored to work with Lit's reactivity system
- `URLStateManager` integration would need updates to trigger Lit updates
- Component inheritance pattern would change from `WebComponent` to `LitElement`
- Modal/Slide panel wrapper components need Lit equivalents
- Form components (EntityCreateForm, EntityEditForm) are complex and would need careful migration

**Existing Strengths to Preserve**:
- URL as source of truth (ADR 0002) - should stay
- Observer pattern state management could become Lit stores
- TypeScript + ES2020 target alignment with Lit's modern approach
- No transpilation requirement maintained

---

This plan provides a structured, incremental approach to migrating Trackly's frontend to Lit while preserving the architectural principles (URL-driven state, TypeScript-first, modern ES2020 targets) and maintaining app functionality throughout the migration process.
