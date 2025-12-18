# Trackly Architecture

## Component-Based Architecture Overview

This document describes the architectural decisions and patterns used in Trackly.

## Directory Structure

```
trackly/
├── index.html              # Entry point HTML
├── styles.css              # Global styles
├── DESIGN.md              # Conceptual design document
├── ARCHITECTURE.md        # This file
├── README.md              # User documentation
└── src/                   # Source code
    ├── app.js             # Application orchestrator
    ├── components/        # UI Components
    │   ├── Component.js   # Base component class
    │   ├── Tabs.js        # Tab navigation component
    │   ├── EntityForm.js  # Entity creation form component
    │   ├── EntityList.js  # Entity list display component
    │   ├── EntryForm.js   # Entry creation form component
    │   └── EntryList.js   # Entry list display component
    ├── models/            # Domain models
    │   ├── Entity.js      # Entity model & validation
    │   └── Entry.js       # Entry model & validation
    ├── state/             # State management
    │   └── Store.js       # Central state store
    └── utils/             # Utility functions
        ├── storage.js     # localStorage abstraction
        └── helpers.js     # Helper functions
```

## Architecture Layers

```
┌─────────────────────────────────────────┐
│           User Interface (HTML)          │
│         Tab Navigation & Forms           │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│          Component Layer                 │
│  EntityForm | EntityList | EntryForm     │
│         EntryList | Tabs                 │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│           State Layer (Store)            │
│    Observable State + Business Logic     │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│           Model Layer                    │
│      Entity Model | Entry Model          │
│      (Validation & Serialization)        │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│        Persistence Layer                 │
│          localStorage API                │
└─────────────────────────────────────────┘
```

## Design Patterns

### 1. Component Pattern

Each UI component:
- Extends base `Component` class
- Has lifecycle methods (mount, render, unmount)
- Subscribes to state changes
- Re-renders when state updates
- Manages its own event handlers

**Example:**
```javascript
class EntityList extends Component {
    render() {
        // Update DOM based on current state
    }

    attachEventListeners() {
        // Handle user interactions
    }
}
```

### 2. Observer Pattern (Pub/Sub)

The Store implements the observer pattern:
- Components subscribe to state changes
- Store notifies subscribers when state updates
- Enables reactive UI updates

**Flow:**
```
User Action → Component Handler → Store Update →
Notify Subscribers → Components Re-render
```

### 3. Model Pattern

Domain models encapsulate:
- Data structure
- Validation logic
- Factory methods
- Serialization/deserialization

**Benefits:**
- Single source of truth for business rules
- Consistent validation across the app
- Easy to test

### 4. Separation of Concerns

Clear boundaries between:
- **UI Components**: Presentation logic only
- **Store**: State management and business operations
- **Models**: Data structure and validation
- **Utils**: Pure helper functions

## Data Flow

### Creating an Entity

```
1. User fills form in EntityForm component
2. User clicks "Create Entity"
3. EntityForm.handleSubmit() is called
4. Entity.fromFormData() creates Entity instance
5. Entity.validate() checks for errors
6. Store.addEntity() adds to state
7. Store saves to localStorage
8. Store notifies all subscribers
9. EntityList re-renders with new data
10. EntryForm updates entity dropdown
```

### Logging an Entry

```
1. User selects entity and fills form
2. User clicks "Log Entry"
3. EntryForm.handleSubmit() is called
4. Entry.fromFormData() creates Entry instance
5. Entry.validate() checks for errors
6. Store.addEntry() adds to state
7. Store saves to localStorage
8. Store notifies all subscribers
9. EntryList re-renders with new entry
```

## State Management

### Store Responsibilities

- Maintain application state (entities, entries)
- Provide CRUD operations
- Validate operations via models
- Persist to localStorage
- Notify subscribers of changes
- Enforce business rules (unique names, etc.)

### State Structure

```javascript
{
    entities: [
        {
            id: "unique-id",
            name: "Morning Run",
            type: "Habit",
            unit: "minutes",
            target: "30",
            frequency: "daily",
            categories: ["health", "exercise"],
            createdAt: "2025-01-15T10:00:00Z"
        },
        // ... more entities
    ],
    entries: [
        {
            id: "unique-id",
            entityId: "parent-entity-id",
            entityName: "Morning Run",
            value: "25",
            timestamp: "2025-01-15T07:00:00Z",
            notes: "Felt great today!",
            createdAt: "2025-01-15T10:00:00Z"
        },
        // ... more entries
    ]
}
```

## Component Lifecycle

### Mount Phase
```javascript
component.mount('#container')
1. Find container element
2. Subscribe to store
3. Initial render
4. Attach event listeners
```

### Update Phase
```javascript
Store updates → notify() → subscribers called → render()
1. Store state changes
2. Store notifies subscribers
3. Component re-renders
4. Re-attach event handlers if needed
```

### Unmount Phase
```javascript
component.unmount()
1. Unsubscribe from store
2. Clean up event listeners
3. Remove from DOM (if needed)
```

## Testing Strategy

### Unit Tests
- Model validation
- Utility functions
- Store operations

### Integration Tests
- Component rendering
- User interactions
- State updates

### E2E Tests
- Complete user flows
- Data persistence
- Cross-component communication

## Performance Considerations

1. **Efficient Re-rendering**: Only update changed DOM elements
2. **Event Delegation**: Use event delegation where possible
3. **Debouncing**: For search/filter operations (future)
4. **Lazy Loading**: Load only visible entries (future)
5. **localStorage Limits**: Monitor storage usage

## Security Considerations

1. **XSS Prevention**: Always escape HTML using `escapeHtml()`
2. **Input Validation**: Validate all user input in models
3. **Data Sanitization**: Clean data before storage
4. **CSP Headers**: Add Content Security Policy (future)

## Scalability

The architecture supports:
- Adding new entity types
- Adding new components
- Extending analytics capabilities
- Implementing real-time sync (future)
- Adding backend API (future)

## Future Improvements

1. **TypeScript**: Add static typing
2. **Build System**: Webpack/Vite for optimization
3. **Testing**: Add Jest/Vitest
4. **State Management**: Consider Redux/Zustand for complex state
5. **Backend**: Add API for multi-device sync
6. **PWA**: Service workers for offline support
