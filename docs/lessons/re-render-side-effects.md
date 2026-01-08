# Re-render Side Effects and Fixes

**Date:** 2025-01-08
**Issue:** Opening modal panels caused scroll position reset in entry list
**Root Cause:** Reactive store pattern + innerHTML replacement

---

## Table of Contents

1. [Problem Overview](#problem-overview)
2. [Architecture Analysis](#architecture-analysis)
3. [The Problem Chain](#the-problem-chain)
4. [Three-Layer Fix](#three-layer-fix)
5. [Common Re-render Side Effects](#common-re-render-side-effects)
6. [Performance Considerations](#performance-considerations)
7. [Key Takeaways](#key-takeaways)

---

## Problem Overview

### Symptom
When users opened modal panels (Add Entry, Create Entity, etc.), the entries list scroll position would reset to the top.

### User Impact
- Lost position in long entry lists
- Frustrating user experience
- Required manual scrolling to find previous location

### Files Affected
- `/packages/frontend/src/app.ts` - Routing and view management
- `/packages/frontend/src/components/EntryListComponent.ts` - Entry rendering
- `/packages/frontend/src/components/WebComponent.ts` - Base component class
- `/packages/frontend/src/state/Store.ts` - Global state management

---

## Architecture Analysis

### The Reactive Store Pattern

Trackly uses a **global store with observer pattern**:

```typescript
// Store.ts
class Store {
    private listeners: Function[] = [];

    subscribe(listener: Function): Unsubscribe {
        this.listeners.push(listener);
        return () => { /* unsubscribe */ };
    }

    private notify(): void {
        this.listeners.forEach(listener => listener());
    }

    setSelectedEntityId(id: string | null): void {
        this.selectedEntityId = id;
        this.notify(); // ← Broadcasts to ALL components
    }
}
```

```typescript
// WebComponent.ts
abstract class WebComponent extends HTMLElement {
    connectedCallback(): void {
        // Every component subscribes to store changes
        this.unsubscribe = this.store.subscribe(() => this.render());
    }
}
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────┐
│                    Store                         │
│  - entities: Entity[]                            │
│  - entries: Entry[]                              │
│  - selectedEntityId: string | null               │
│  - listeners: Function[]  ← All components here  │
└─────────────────────────────────────────────────┘
                    ↓ notify()
        ┌───────────┼───────────┐
        ↓           ↓           ↓
   EntityList  EntryList   EntryDetail
   component   component    component
        │           │            │
        └───────────┴────────────┘
         All call render() when notified
```

---

## The Problem Chain

### Step-by-Step Breakdown

#### 1. User Action
```javascript
// User clicks "Add Entry" button
<button onclick="URLStateManager.openLogEntryPanel()">
  Add Entry
</button>
```

#### 2. URL Change
```
Before: /entries
After:  /entries?panel=log-entry
```

#### 3. URL Listener Triggered
```typescript
// app.ts:229
URLStateManager.subscribe(updateView);
// ↑ Called whenever URL changes
```

#### 4. updateView() Updates Store
```typescript
// app.ts:260 (BEFORE FIX)
private updatePanelState(panelType, panel) {
    if (panelType === 'log-entry') {
        // ⚠️ THIS LINE CAUSES THE CASCADE
        this.store.setSelectedEntityId(entity.id);
    }
}
```

#### 5. Store Notifies ALL Subscribers
```typescript
// Store.ts:211-214
setSelectedEntityId(entityId: string | null): void {
    this.selectedEntityId = entityId;
    this.notify();  // ← Broadcasts to EVERY component! 📢
}
```

#### 6. EntryListComponent Re-renders
```typescript
// WebComponent.ts:20
this.unsubscribe = this.store.subscribe(() => this.render());
//                                        ↑ This gets called!
```

#### 7. innerHTML Replacement Resets Scroll
```typescript
// EntryListComponent.ts render()
this.innerHTML = `
    <div class="entries-list scrollable-grid">
        ${entriesHtml}
    </div>
`;
// ↑ New <div> created with scrollTop = 0
```

### Why This Pattern Is Problematic

**Pros:**
- ✅ Simple to understand
- ✅ Components always stay in sync
- ✅ No manual data binding

**Cons:**
- ❌ ALL components re-render on ANY store change
- ❌ No granular control
- ❌ Side effects like scroll position are lost
- ❌ Performance overhead from unnecessary re-renders

---

## Three-Layer Fix

We implemented a defensive three-layer approach:

### Layer 1: Skip View Re-rendering on Query-Only Changes

**File:** `app.ts:60-94`

```typescript
private setupViewRouting(): void {
    // Track last pathname to detect when only query params changed
    let lastPathname: string = window.location.pathname;

    const updateView = () => {
        const path = window.location.pathname;

        // Detect if only query parameters changed (not the path)
        const onlyQueryChanged = path === lastPathname;
        lastPathname = path;

        // If only query params changed (e.g., opening a modal), skip view re-rendering
        if (onlyQueryChanged) {
            // Only update panel state, don't re-render views
            this.updatePanelState(panelType, panel);
            return; // ← Exit early!
        }

        // ... rest of routing logic only runs if path changed ...
    };
}
```

**What it prevents:**
- ✅ Skips full routing logic when only `?panel=log-entry` changes
- ✅ Prevents unnecessary view re-renders
- ✅ Preserves all UI state

---

### Layer 2: Only Update Store if Value Changed

**File:** `app.ts:259`

```typescript
private updatePanelState(panelType: any, panel: any): void {
    if (panelType === 'log-entry') {
        const entity = ...;

        // BEFORE: Always updated, always triggered notify()
        // this.store.setSelectedEntityId(entity.id);

        // AFTER: Only update if value actually changed
        if (entity && this.store.getSelectedEntityId() !== entity.id) {
            this.store.setSelectedEntityId(entity.id);
        }
    }
}
```

**What it prevents:**
- ✅ Prevents unnecessary `notify()` broadcasts
- ✅ Avoids triggering re-renders when state hasn't changed
- ✅ Better performance

---

### Layer 3: Preserve Scroll Even if Re-render Happens

**File:** `EntryListComponent.ts:18-20, 383-388`

```typescript
render(): void {
    // Save scroll position BEFORE re-rendering
    const scrollableGrid = this.querySelector('.scrollable-grid') as HTMLElement;
    const savedScrollTop = scrollableGrid ? scrollableGrid.scrollTop : 0;

    // ... generate HTML and set innerHTML ...

    this.innerHTML = `
        <div class="entries-list scrollable-grid">
            ${entriesHtml}
        </div>
    `;

    // ... attach event listeners ...

    // Restore scroll position AFTER re-rendering
    if (savedScrollTop > 0) {
        const newScrollableGrid = this.querySelector('.scrollable-grid') as HTMLElement;
        if (newScrollableGrid) {
            newScrollableGrid.scrollTop = savedScrollTop;
        }
    }
}
```

**What it prevents:**
- ✅ Manual scroll restoration as last resort
- ✅ Works even if Layers 1 & 2 fail
- ✅ Defense in depth

---

## Common Re-render Side Effects

When `innerHTML` is replaced, these side effects occur:

### 1. ✅ Scroll Position (FIXED)
**Impact:** High
**Status:** ✅ Preserved with Layer 3

---

### 2. ⚠️ Event Listeners Must Be Re-attached
**Impact:** Medium (Performance)

**What happens:**
```typescript
// Before render: Button has click listener
<button onclick="handleClick()">Sort</button>

// After innerHTML replacement: Listener GONE
<button>Sort</button>  // ← Dead button!

// Must re-attach:
this.attachSortHandler();
this.attachMenuHandlers();
// ... etc
```

**Your code handles this:** ✅ Yes, re-attaches after every render

**Performance cost:**
- Creating many event listeners repeatedly
- ~10 attach methods called per render

---

### 3. ⚠️ ResizeObserver Must Be Recreated
**Impact:** Medium (Performance)

**What happens:**
```typescript
// EntryListComponent.ts:404-419
private setupResizeObserver(): void {
    // Clean up existing observer (GOOD!)
    if (this.resizeObserver) {
        this.resizeObserver.disconnect();
    }

    // Create NEW observer
    this.resizeObserver = new ResizeObserver(() => {
        this.detectTruncatedContent();
    });

    // Re-observe all cards
    this.querySelectorAll('.entry-card').forEach(card => {
        this.resizeObserver!.observe(card as HTMLElement);
    });
}
```

**Your code handles this:** ✅ Yes, properly cleaned up and recreated

---

### 4. ❌ Focus State Lost
**Impact:** High (Accessibility)

**What happens:**
```typescript
// User has keyboard focused this button
<button class="btn-sort" [focused]>Sort ▼</button>

// After re-render: Focus lost
<button class="btn-sort">Sort ▼</button>
```

**Impact:**
- ❌ Keyboard navigation broken
- ❌ Screen reader users lose context
- ❌ Must manually refocus

**Your code handles this:** ❌ Not preserved

**Potential fix:**
```typescript
render(): void {
    // Save focus
    const activeElement = this.querySelector(':focus') as HTMLElement;
    const focusSelector = activeElement?.dataset?.id ?
        `[data-id="${activeElement.dataset.id}"]` : null;

    // ... render ...

    // Restore focus
    if (focusSelector) {
        const newElement = this.querySelector(focusSelector) as HTMLElement;
        newElement?.focus();
    }
}
```

---

### 5. ❌ Text Selection Lost
**Impact:** Medium (UX)

**What happens:**
```
User selects text: "Buy groceries [for dinner]"
After re-render: Selection lost
```

**Your code handles this:** ❌ Not preserved (very hard to fix)

---

### 6. ⚠️ Dropdown/Menu State Lost
**Impact:** Medium (UX)

**What happens:**
```typescript
// User opens dropdown
<div class="dropdown active">
    <ul>...</ul>
</div>

// After re-render: Dropdown closed
<div class="dropdown">
    <ul>...</ul>
</div>
```

**Your code:** Need to verify if dropdowns can be open during re-render

**CSS classes affected:**
- `.context-menu.active`
- `.dropdown.active`
- `.tag-filter-dropdown.active`

---

### 7. ⚠️ Animation State Interrupted
**Impact:** Low (Visual)

**What happens:**
```css
.entry-card {
    animation: slideIn 0.3s ease-out;
}
```

After re-render, animation restarts from beginning.

**Your code handles this:** ❌ Animations restart

---

### 8. ⚠️ Layout Thrashing (Performance)
**Impact:** Medium (Performance)

**What happens:**
```typescript
render(): void {
    this.innerHTML = `...`; // ← Forces reflow (write)

    // Then immediately read layout properties
    this.detectTruncatedContent(); // ← Reads scrollHeight (read)
    this.setupResizeObserver();   // ← Reads sizes (read)
}
```

**Issue:** Write → Read → Write → Read causes forced synchronous layout

**Optimization:**
```typescript
render(): void {
    this.innerHTML = `...`;

    // Batch layout reads in next frame
    requestAnimationFrame(() => {
        this.detectTruncatedContent();
        this.setupResizeObserver();
    });
}
```

---

## Performance Considerations

### Does Re-render Cause API Calls?

**Answer: NO** ✅

Components only read from the store's **in-memory cache**. API calls happen only:

1. **Initial load** (once)
   ```typescript
   // Store.ts:27
   constructor() {
       this.loadData(); // ← API call
   }
   ```

2. **Sort parameter changes**
   ```typescript
   // app.ts:156-159
   if (sortBy !== lastSortBy || sortOrder !== lastSortOrder) {
       this.store.reloadEntries(sortBy, sortOrder); // ← API call
   }
   ```

3. **CRUD operations**
   ```typescript
   await APIClient.deleteEntry(id);  // ← API call
   await this.store.reloadEntries(); // ← Refresh
   ```

**Evidence:**
```bash
grep -r "APIClient" src/components/
# Result: Only found in AuthComponent.ts
```

Components NEVER directly call the API!

---

### The Fixed Flow

```
User clicks "Add Entry"
  ↓
URL: /entries → /entries?panel=log-entry
  ↓
updateView() detects onlyQueryChanged = true (Layer 1)
  ↓
Skips full routing logic ✓
  ↓
Only calls updatePanelState() ✓
  ↓
Checks if selectedEntityId changed (Layer 2)
  ↓
Unchanged, skips setSelectedEntityId ✓
  ↓
No store.notify() broadcast ✓
  ↓
No component re-renders ✓
  ↓
Scroll position preserved! ✅
```

---

## Key Takeaways

### 1. Reactive Patterns Can Cause Cascading Effects
- Store broadcasts trigger ALL subscribers
- Small changes can cause large-scale re-renders
- Need defensive checks to prevent unnecessary updates

### 2. innerHTML Replacement Has Many Side Effects
- Not just scroll position!
- Event listeners, observers, focus, selection all lost
- Must explicitly preserve or recreate

### 3. Defense in Depth
- Layer 1: Prevent unnecessary calls (best)
- Layer 2: Check before updating state (good)
- Layer 3: Preserve state manually (last resort)

### 4. Better Alternatives to innerHTML
- **Virtual DOM** (React, Vue): Diffs changes, preserves state
- **Fine-grained reactivity** (Solid, Svelte): Update only what changed
- **Selective subscriptions**: Components subscribe to specific slices
- **DOM patching**: Update nodes instead of replacing

### 5. Always Consider UX Side Effects
When implementing re-render logic:
- ✅ Scroll position
- ✅ Focus state
- ✅ Text selection
- ✅ Dropdown state
- ✅ Animation state
- ✅ Form input state

---

## Related Files

- `/packages/frontend/src/app.ts` - Main fix (Layer 1 & 2)
- `/packages/frontend/src/components/EntryListComponent.ts` - Scroll preservation (Layer 3)
- `/packages/frontend/src/components/WebComponent.ts` - Base class subscription pattern
- `/packages/frontend/src/state/Store.ts` - Store notify pattern
- `/packages/frontend/src/utils/urlState.ts` - URL state management

---

## Future Improvements

### Short-term
1. ✅ Preserve scroll position (DONE)
2. Add focus preservation
3. Optimize layout thrashing with requestAnimationFrame

### Long-term
1. Consider migrating to Virtual DOM framework (React/Vue)
2. Implement fine-grained subscriptions (subscribe to specific store slices)
3. Use DOM patching instead of innerHTML replacement
4. Evaluate Solid.js or Svelte for fine-grained reactivity

---

**Last Updated:** 2025-01-08
**Author:** Development team with AI assistance
