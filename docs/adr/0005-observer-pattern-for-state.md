# ADR 0005: Use Observer Pattern for State Management

## Status
Accepted

## Context
We needed a state management solution for:
- Centralizing application data (entities, entries)
- Notifying UI components of changes
- Persisting data to localStorage

Options considered:
- Global state object with manual updates
- Redux-like pattern
- Observer pattern with subscribe/notify
- Reactive framework (MobX, Signals)

## Decision
We will use a simple **Observer pattern** implemented in a custom `Store` class.

## Rationale
1. **Simplicity**: Easy to understand and implement
2. **No dependencies**: Built from scratch
3. **Sufficient**: For our use case, we don't need Redux complexity
4. **Educational**: Learn fundamental patterns
5. **Web Component friendly**: Works well with Custom Elements lifecycle

## Store API
```typescript
class Store {
  subscribe(callback: () => void): Unsubscribe
  notify(): void

  // Data methods
  getEntities(): Entity[]
  addEntity(entity: Entity): void
  // ... etc
}
```

## Consequences

### Positive
- Simple mental model: change → notify → re-render
- Minimal boilerplate
- Easy to debug (console.log in notify)
- Full control over when re-renders happen

### Negative
- No memoization/optimization
- Could cause unnecessary re-renders (all subscribers notified on any change)
- No time-travel debugging
- No devtools integration

## Implementation
1. `Store` maintains subscribers array
2. Components call `store.subscribe(callback)` in `connectedCallback`
3. Components call `unsubscribe()` in `disconnectedCallback`
4. Callback typically triggers `render()`
5. Store calls `notify()` after any state change
6. `StoreRegistry` provides global access to single Store instance
