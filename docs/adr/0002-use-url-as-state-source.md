# ADR 0002: Use URL as Source of Truth for Navigation State

## Status
Accepted

## Context
The application needs to manage navigation state including:
- Current view (entity grid vs entry list)
- Selected entity
- Open panel (log entry, create entity, edit entity)

We needed to decide where this state should live:
- In-memory JavaScript state only
- LocalStorage
- URL parameters
- Combination of above

## Decision
We will use the **URL as the single source of truth** for all navigation state, managed by a `URLStateManager` class.

## Rationale
1. **Shareable links**: Users can bookmark or share exact application state
2. **Browser back/forward**: Works automatically with browser navigation
3. **Refresh resilience**: Reloading the page restores exact state
4. **Debugging**: Current state is visible in the address bar
5. **Stateless server**: No need for server-side session management
6. **Deep linking**: Can link directly to specific entities or views

## URL Structure
```
Base: /
Entity grid: /
Entry list: /?entity=Morning%20Run&view=entries
Log entry panel: /?entity=Morning%20Run&panel=log-entry
Create entity: /?panel=create-entity
Edit entity: /?panel=edit-entity&edit=Morning%20Run
```

## Consequences

### Positive
- Excellent user experience with shareable, bookmarkable URLs
- Browser navigation works intuitively
- State is transparent and debuggable
- Enables deep linking

### Negative
- URL can get long with multiple parameters
- Need to properly encode/decode entity names
- Must handle URL changes from browser back/forward
- State sync between URL and internal store adds complexity

## Implementation
1. `URLStateManager` class manages all URL state
2. Uses `pushState` for navigation without page reload
3. Listens to `popstate` events for browser back/forward
4. All navigation actions update URL, not internal state directly
5. Store state (selectedEntityId) syncs from URL state
6. Entity names used in URL instead of IDs for human-readability
