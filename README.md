# Trackly - Personal Tracking App

A modern, component-based web application for tracking habits, tasks, expenses, and moods. Built with TypeScript and vanilla JavaScript following clean architecture principles.

## Features

- **Create Entities**: Define trackable items with type, unit, target, frequency, and categories
- **Log Entries**: Record measurements and observations for each entity over time
- **Data Persistence**: All data stored locally in browser's localStorage
- **Responsive Design**: Card-based, minimalist UI that works on desktop and mobile
- **Component-Based Architecture**: Modular, maintainable, and scalable code structure
- **TypeScript**: Full type safety and excellent IDE support

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Open index.html in your browser
```

### Development

```bash
# Development mode - auto-recompile + live-reload server
npm run watch
# or
npm run dev

# This will:
# 1. Start TypeScript compiler in watch mode
# 2. Start live-server on http://localhost:8080
# 3. Auto-reload browser when files change
```

## Architecture

### Component-Based Structure

```
src/
├── types/              # TypeScript type definitions
│   └── index.ts        # Core interfaces and types
├── components/         # UI Components
│   ├── Component.ts    # Base component class
│   ├── Tabs.ts         # Tab navigation
│   ├── EntityForm.ts   # Entity creation form
│   ├── EntityList.ts   # Entity display grid
│   ├── EntryForm.ts    # Entry logging form
│   └── EntryList.ts    # Entry display list
├── models/             # Data Models
│   ├── Entity.ts       # Entity model with validation
│   └── Entry.ts        # Entry model with validation
├── state/              # State Management
│   └── Store.ts        # Central state store with pub/sub
├── utils/              # Utilities
│   ├── storage.ts      # localStorage wrapper
│   └── helpers.ts      # Helper functions
└── app.ts              # Main application orchestrator
```

### Key Design Patterns

1. **Component Pattern**: Reusable UI components with lifecycle methods
2. **Observer Pattern**: Store notifies components of state changes
3. **Model Pattern**: Business logic and validation in model classes
4. **Separation of Concerns**: Clear boundaries between UI, state, and business logic
5. **Type Safety**: TypeScript provides compile-time type checking

## UI Design

### Card-Based + Minimalist

- **Clean, White Design**: Minimal color palette with subtle shadows
- **Card Layout**: Everything is organized in clean cards
- **Generous Whitespace**: Breathing room for better readability
- **Subtle Interactions**: Smooth transitions and hover states
- **Accessible**: Proper focus states and semantic HTML

### Color System

- Primary: Blue (#2563eb)
- Text: Gray scale for hierarchy
- Type Badges: Soft, muted colors with good contrast
- Borders: Light gray for subtle separation

## Entity Types

- **Habit**: Track recurring behaviors (e.g., exercise, reading)
- **Task**: Track completion of specific tasks
- **Expense**: Track spending and financial data
- **Mood**: Track emotional states and wellbeing

## How to Use

1. **Create an Entity**: Go to the "Entities" tab and fill out the form
2. **Log Entries**: Switch to "Log Entry" tab and record your data
3. **View Progress**: See your entities and recent entries organized by cards

## Technical Stack

- **TypeScript**: Type-safe JavaScript with compile-time checking
- **HTML5**: Semantic markup
- **CSS3**: Modern, minimalist card-based design
- **ES Modules**: Native browser module system
- **localStorage**: Client-side data persistence

## Type Safety

All core concepts are typed:

```typescript
interface IEntity {
    id: string;
    name: string;
    type: EntityType;
    unit: string;
    target: string;
    frequency: Frequency;
    categories: string[];
    createdAt: string;
}

type EntityType = 'Habit' | 'Task' | 'Expense' | 'Mood';
```

## Development

### Build Commands

```bash
# Build once
npm run build

# Development mode (watch + live-server with auto-reload)
npm run dev
# or
npm run watch

# Clean build directory
npm run clean
```

### Adding New Features

1. **Add a new component**: Extend `Component` class in `src/components/`
2. **Add new model**: Create class in `src/models/` with proper types
3. **Extend store**: Add typed methods in `src/state/Store.ts`
4. **Add utilities**: Create in `src/utils/` with proper type definitions
5. **Update types**: Add interfaces/types in `src/types/index.ts`

## Project Structure

```
trackly/
├── index.html              # Entry point HTML
├── styles.css              # Global styles (minimalist design)
├── package.json            # npm dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── DESIGN.md               # Conceptual design document
├── ARCHITECTURE.md         # Architecture documentation
├── README.md               # This file
├── src/                    # TypeScript source code
│   ├── types/              # Type definitions
│   ├── components/         # UI components
│   ├── models/             # Domain models
│   ├── state/              # State management
│   ├── utils/              # Utilities
│   └── app.ts              # Main entry point
└── dist/                   # Compiled JavaScript (generated)
```

## Browser Support

Works in all modern browsers that support:
- ES2020
- ES Modules
- localStorage
- CSS Grid & Flexbox

## Future Enhancements

- Analytics dashboard with charts and visualizations
- Export/import data functionality
- Streak tracking with calendar view
- Goal progress indicators
- Search and filter capabilities
- Data visualization with charts (Chart.js/D3.js)
- PWA support for offline usage
- Backend API for multi-device sync
- Dark mode support

## License

MIT
