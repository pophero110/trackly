# Trackly UI Design Documentation

## Overview

Trackly uses a modern, clean UI design with a focus on usability and accessibility. The design follows contemporary patterns with subtle animations, clear hierarchy, and responsive layouts.

## Design System

### Color Palette

#### Light Mode
- **Primary**: `#3b82f6` (Blue) - Primary actions, links, accents
- **Background**: `#f9fafb` (Light gray) - Main background
- **Card Background**: `#ffffff` (White) - Cards, panels, forms
- **Text Primary**: `#111827` (Near black) - Main text
- **Text Muted**: `#6b7280` (Gray) - Secondary text, labels
- **Border**: `#e5e7eb` (Light gray) - Dividers, borders
- **Success**: `#10b981` (Green) - Success states
- **Warning**: `#f59e0b` (Amber) - Warning states
- **Danger**: `#ef4444` (Red) - Error states, delete actions

#### Entity Type Colors
- **Habit**: `#8b5cf6` (Purple)
- **Task**: `#3b82f6` (Blue)
- **Mood**: `#ec4899` (Pink)
- **Node**: `#14b8a6` (Teal)
- **Event**: `#f59e0b` (Amber)
- **Idea**: `#a855f7` (Purple)
- **Book**: `#06b6d4` (Cyan)
- **Article**: `#6366f1` (Indigo)
- **Paper**: `#8b5cf6` (Violet)
- **Project**: `#059669` (Emerald)
- **Concept**: `#d946ef` (Fuchsia)
- **Decision**: `#9333ea` (Purple)
- **Communication**: `#06b6d4` (Cyan)
- **Exercise**: `#10b981` (Green)
- **Metric**: `#f59e0b` (Amber)
- **Activity**: `#6366f1` (Indigo)
- **Goal**: `#f43f5e` (Rose)
- **Plan**: `#c084fc` (Light purple)

### Typography

- **Base Font**: System font stack for native feel
  ```css
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
               'Helvetica Neue', Arial, sans-serif
  ```
- **Font Sizes**:
  - Body: `1rem` (16px)
  - Small: `0.875rem` (14px)
  - Heading 1: `2rem` (32px)
  - Heading 2: `1.5rem` (24px)
  - Heading 3: `1.25rem` (20px)
- **Line Heights**:
  - Body: `1.5`
  - Headings: `1.2`

### Spacing

Based on 8px grid system:
- **xs**: `4px`
- **sm**: `8px`
- **md**: `16px`
- **lg**: `24px`
- **xl**: `32px`

### Border Radius

- **Small**: `4px` - Buttons, inputs
- **Medium**: `8px` - Cards, panels
- **Large**: `12px` - Modals, major containers

### Shadows

- **Small**: `0 1px 3px rgba(0, 0, 0, 0.1)` - Buttons, small cards
- **Medium**: `0 4px 6px rgba(0, 0, 0, 0.1)` - Cards
- **Large**: `0 10px 25px rgba(0, 0, 0, 0.15)` - Modals, dropdowns

## Component Designs

### 1. Entity Grid

**Purpose**: Home view displaying all entities in a grid layout

**Layout**:
- Responsive grid (1-3 columns based on screen size)
- Equal-height cards with auto-fit sizing
- Gap: 24px between cards

**Entity Card**:
- **Header**: Entity name (h3, bold)
- **Type Badge**: Color-coded pill badge
- **Categories**: Hashtag-style tags
- **Recent Entry Preview**:
  - Timestamp (relative: "Today", "2 days ago")
  - Value display with formatting
  - Custom property values (compact display)
  - Notes preview (truncated)
- **Expand Button**: Top-right corner (’), visible on hover
- **Actions**: Right-click context menu (Edit, Delete)

**Interactions**:
- Click card ’ Open log entry form
- Click expand button ’ View entry list
- Right-click ’ Context menu
- Hover ’ Highlight card, show expand button

### 2. Entry List

**Purpose**: Chronological list of entries for a specific entity

**Layout**:
- Vertical list with most recent first
- Fixed header with back button and "Log Entry" button
- Scrollable content area

**Entry Card**:
- **Header**: Timestamp + Delete button
- **Value**: Large, prominent display with formatting
- **Custom Properties**: Labeled values with type-specific formatting
- **Notes**: Rich text with clickable links
- **Images**: Thumbnail grid if present

**Interactions**:
- Click card ’ Edit entry
- Click delete ’ Confirm and delete
- Click back ’ Return to grid
- Click "Log Entry" ’ Open form

### 3. Modal Forms

**Purpose**: Create/edit entities and entries

**Pattern**: Centered modal with backdrop

**Structure**:
- **Backdrop**: Semi-transparent overlay (rgba(0, 0, 0, 0.5))
- **Dialog**: Centered, max-width 600px, 90% width
- **Header**: Title + close button (×)
- **Body**: Form content with scrolling
- **Actions**: Primary/secondary buttons

**Animations**:
- **Open**: Fade in + scale up (0.95 ’ 1.0) over 200ms
- **Close**: Fade out + scale down (1.0 ’ 0.95) over 200ms

**Closing**:
- Click backdrop
- Click close button (×)
- Press ESC key
- Submit form

### 4. Forms

**Entity Form**:
- Entity name (required)
- Entity type (select)
- Categories (comma/space separated, hashtag syntax optional)
- Value type (optional select)
- Custom properties section:
  - Add Property button ’ Opens property modal
  - Property list with type badges and remove buttons

**Entry Form**:
- Entity select (dropdown with search)
- Value input (dynamic based on entity value type)
- Custom property inputs (dynamic based on entity properties)
- Notes (textarea)
- Images:
  - Upload button (=Á)
  - Camera button (=÷)
  - Preview grid with remove buttons

**Property Modal**:
- Property name (required)
- Property type (select): Number, Text, URL, Checkbox, Date, Time, Duration, Rating
- Required checkbox
- Add/Cancel buttons

### 5. Value Type Inputs

Smart input types based on value type:

- **Text**: Text input with placeholder
- **Number**: Number input with step
- **URL**: URL input with title fetching
- **Email**: Email input with validation
- **Tel**: Tel input
- **Date/Time**: Native date/time pickers
- **Checkbox**: Toggle checkbox
- **Select**: Dropdown with predefined options
- **Color**: Color picker
- **Duration**: Number input with "minutes" label
- **Rating**: Number input 1-5 with "/5" label
- **Range**: Slider with live value display
- **Image/Audio/Video**: URL input with preview

### 6. Property Value Display

**In Entry Cards**:
- Labeled format: `Property Name: Value`
- Type-specific formatting:
  - **Checkbox**:  Yes /  No
  - **URL**: Clickable link with fetched title
  - **Duration**: "X minutes"
  - **Rating**: "X/5"
  - **Date/Time**: Formatted display

**In Entity Grid (Compact)**:
- Smaller font size
- Truncated URLs/titles (25 chars)
- Abbreviated units (e.g., "min" vs "minutes")

### 7. Status Badges

For select-type values (Task, Decision, Goal, Plan):

**Task Statuses**:
- `todo`: "To Do" - Light blue background
- `in-progress`: "In Progress" - Yellow background
- `done`: "Done" - Green background

**Decision Statuses**:
- `yes`: "Yes" - Green background
- `no`: "No" - Red background
- `pending`: "Pending" - Yellow background

**Goal Statuses**:
- `not-started`: "Not Started" - Gray background
- `in-progress`: "In Progress" - Yellow background
- `completed`: "Completed" - Green background

**Plan Statuses**:
- `draft`: "Draft" - Gray background
- `active`: "Active" - Blue background
- `completed`: "Completed" - Green background
- `on-hold`: "On Hold" - Orange background

### 8. Image Handling

**Upload**:
- File picker (multiple selection)
- Base64 encoding for localStorage
- Immediate preview after selection

**Camera Capture**:
- Full-screen camera modal
- Live video preview
- Capture button (=ø)
- Front/back camera toggle (if available)
- Image saved as base64 JPEG (0.8 quality)

**Display**:
- Grid layout (2-3 columns)
- Responsive sizing
- Thumbnail view in cards
- Remove button (×) overlay on hover

### 9. Context Menu

**Trigger**: Right-click on entity card

**Menu Items**:
- Edit (opens entity edit form)
- Delete (with confirmation)

**Styling**:
- White background
- Border shadow
- Hover highlight
- Positioned at cursor
- Closes on outside click

### 10. Rich Text Formatting

**Auto-linking**:
- Detects URLs in notes/text values
- Fetches page titles asynchronously
- Stores as `[[title::url]]` format
- Displays as clickable links with titles

**URL Title Fetching**:
- CORS proxy attempts (corsproxy.io, allorigins)
- 5-second timeout per proxy
- Falls back to hostname if all fail
- Applied to:
  - Main entry value (if URL type)
  - Custom property values (if URL type)
  - URLs in notes field

## Responsive Design

### Breakpoints

- **Mobile**: < 480px
- **Tablet**: 480px - 768px
- **Desktop**: > 768px

### Mobile Adaptations

**Entity Grid**:
- Single column layout
- Reduced padding and gaps
- Smaller type badges

**Modals**:
- Nearly full-width (calc(100% - 16px))
- Reduced padding (16px)
- Smaller titles

**Forms**:
- Full-width inputs
- Stacked button layouts
- Touch-friendly tap targets (min 44px)

**Entry Cards**:
- Reduced padding
- Smaller delete buttons
- Compact property display

## Animations

### Timing Functions
- **Ease-out**: UI appearing (200ms)
- **Ease-in**: UI disappearing (200ms)
- **Ease-in-out**: State changes (150ms)

### Modal Animations
- **Open**: `fadeIn` + `modalSlideIn` (scale + translate)
- **Close**: `fadeOut` + `modalSlideOut`

### Micro-interactions
- Button hover: Background color shift (150ms)
- Card hover: Slight elevation increase
- Input focus: Border color + outline
- Badge hover: Subtle scale (1.05)

## Accessibility

### Color Contrast
- Text meets WCAG AA standards (4.5:1 minimum)
- Interactive elements have clear focus states

### Keyboard Navigation
- ESC closes modals
- Tab order follows visual hierarchy
- Focus visible on all interactive elements

### Screen Readers
- Semantic HTML elements
- ARIA labels on icon buttons
- Proper heading hierarchy

### Focus Management
- Focus trapped in open modals
- Focus returned to trigger on close
- Skip to main content available

## Dark Mode

Currently not implemented. Light mode only.

**Future Considerations**:
- CSS custom properties allow easy theming
- System preference detection via `prefers-color-scheme`
- Toggle in settings

## Icons

Emoji icons used for simplicity:
- =Á Upload
- =÷ Camera
- × Close/Remove
- ’ Expand
-  Checkbox checked
-  Checkbox unchecked
- <µ Audio/Video media

**Rationale**: No icon library dependency, universal recognition, accessible

## Performance Considerations

### Image Optimization
- JPEG compression (0.8 quality)
- Base64 storage (trade-off for simplicity)
- Lazy loading not needed (small dataset)

### Animations
- CSS transforms (GPU accelerated)
- `will-change` hints for modal transforms
- Debounced scroll listeners (if added)

### State Updates
- Observer pattern minimizes re-renders
- Targeted DOM updates
- Event delegation for dynamic content

## Future Enhancements

### Planned
- Drag and drop image upload
- Image cropping/editing
- Bulk delete entries
- Export/import data
- Search and filtering
- Data visualization/charts
- Dark mode

### Considered
- Offline PWA support
- Cloud sync
- Mobile app (React Native)
- Drag to reorder entries
- Customizable themes
