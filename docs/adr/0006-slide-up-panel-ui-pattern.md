# ADR 0006: Use Slide-Up Panel for Forms

## Status
Superseded by [ADR-0008](0008-centered-modal-pattern.md)

## Context
We needed to design how users create and edit entities and entries. Options considered:
- Inline forms in the main view
- Tab-based navigation with dedicated form tabs
- Modal dialogs (centered overlays)
- Slide-up panels (bottom sheet pattern)
- Separate pages

## Decision
We will use **slide-up panels** (bottom sheet pattern) for all forms.

## Rationale
1. **Mobile-friendly**: Common pattern in mobile apps, works well on touch devices
2. **Contextual**: Keeps main view visible in background
3. **Modern**: Clean, contemporary UX pattern
4. **Focus**: Panel draws attention without completely blocking view
5. **Smooth transitions**: CSS animations provide polished feel

## Design Details
- Panel slides up from bottom of screen
- Semi-transparent backdrop darkens background
- Centered horizontally with max-width of 600px
- Can be closed via:
  - Close button (×)
  - Clicking backdrop
  - ESC key
  - Form submission

## Consequences

### Positive
- Excellent mobile experience
- Keeps users oriented (can see grid/list behind)
- Smooth animations feel polished
- Flexible height (auto-sizes to content)

### Negative
- More CSS complexity than simple modal
- Animation timing must be considered
- Need to prevent body scroll when open

## Implementation
1. `SlideUpPanel` web component
2. CSS keyframe animations: `slideUpCentered`, `slideDownCentered`, `fadeIn`, `fadeOut`
3. Panel state managed via URL (`?panel=log-entry`)
4. Content injected by cloning template forms
5. z-index layering: backdrop (1000), panel container (1001)
