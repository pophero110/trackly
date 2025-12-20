# ADR 0008: Use Centered Modal Pattern for Forms

## Status
Accepted (Supersedes [ADR-0006](0006-slide-up-panel-ui-pattern.md))

## Context
Initially, forms were displayed using a slide-up panel (bottom sheet) pattern. While this worked well for mobile, it had some drawbacks for desktop users and consistency with other modal dialogs in the app (like the property modal).

We needed a UI pattern that:
- Works well on both mobile and desktop
- Provides consistency across all modal interactions
- Feels modern and polished
- Maintains focus and context

## Decision
We will use **centered modal dialogs** for all forms, replacing the slide-up panel pattern.

## Rationale

### Desktop Experience
1. **Better viewport utilization**: Centered modals work better on wide screens
2. **Conventional pattern**: Users expect modals to be centered on desktop
3. **Consistent with property modal**: The "Add Property" feature already used centered modals

### Consistency
1. **Unified pattern**: All modal interactions now use the same visual pattern
2. **Single component style**: Reduces CSS complexity and maintenance
3. **Predictable behavior**: Users learn one interaction model

### Animation Quality
1. **Subtle scale animation**: Modern feel without being distracting (0.95 → 1.0 scale)
2. **Faster timing**: 200ms (vs 300ms) feels more responsive
3. **Combined transforms**: Scale + fade provides polished appearance

### Accessibility
1. **Clear focus**: Centered position draws attention naturally
2. **Keyboard friendly**: ESC, backdrop click, close button all work
3. **Screen reader friendly**: Proper ARIA structure maintained

## Design Details

### Visual Structure
- **Backdrop**: Semi-transparent overlay (rgba(0, 0, 0, 0.5))
- **Dialog**: Centered, max-width 600px, 90% width
- **Header**: Title + close button (×)
- **Body**: Scrollable content area
- **Layout**: Flexbox column with flex body for proper sizing

### Animations
- **Open**: Fade in + scale (0.95 → 1.0) + translate (-20px → 0) over 200ms
- **Close**: Fade out + scale (1.0 → 0.95) + translate (0 → -20px) over 200ms
- **Easing**: ease-out for smooth, natural motion

### Closing Triggers
- Click backdrop (outside modal)
- Click close button (×)
- Press ESC key
- Form submission success

### Implementation Classes
```css
.modal-backdrop      /* Overlay container with centering */
.modal-dialog        /* The modal box */
.modal-header        /* Header with title and close button */
.modal-title         /* Modal title */
.modal-close         /* Close button */
.modal-body          /* Scrollable content area */
```

## Consequences

### Positive
- **Better desktop UX**: Centered modals feel more natural on large screens
- **Consistency**: All modals use same pattern (forms + property modal)
- **Simpler codebase**: One animation pattern, less CSS
- **Faster animations**: 200ms feels snappier than 300ms
- **Modern feel**: Scale + fade is contemporary and polished

### Negative
- **Less mobile-specific**: Slide-up was more mobile-native
- **Breaking change**: Existing users notice UI change
- **Less distinctive**: More conventional, less unique

### Migration Notes
- Component renamed internally but kept as `SlideUpPanel` for compatibility
- All existing modal-triggering code works without changes
- CSS classes completely refactored (panel-* → modal-*)
- Animation keyframes simplified

## Responsive Behavior

### Desktop (> 768px)
- Modal centered in viewport
- Max-width 600px
- Scale animation prominent

### Tablet (480px - 768px)
- Modal centered in viewport
- Width: calc(100% - 32px)
- Same animations

### Mobile (< 480px)
- Modal nearly full-width: calc(100% - 16px)
- Max-height: 95vh
- Reduced padding for space efficiency

## Implementation Details

### Component Structure
```typescript
class SlideUpPanel extends HTMLElement {
  // Renders modal-backdrop > modal-dialog > modal-header + modal-body
  // Handles open/close state
  // Manages body scroll lock
  // Listens for ESC key, backdrop click, close button
}
```

### State Management
- Panel state stored in URL: `?panel=log-entry&entity=Exercise`
- URLStateManager controls opening/closing
- Body scroll locked when modal open (`overflow: hidden`)
- Content cleared on close

### Animation Performance
- CSS transforms (GPU accelerated)
- Combined opacity + transform for smooth feel
- No JavaScript animation (pure CSS)
- Minimal repaints/reflows

## Future Considerations

1. **Animation preferences**: Respect `prefers-reduced-motion`
2. **Modal stacking**: Handle multiple modals if needed
3. **Swipe to dismiss**: Add gesture support for mobile
4. **Confirmation dialogs**: Consider smaller modal variant
5. **Fullscreen mode**: Option for complex forms on mobile

## Related Decisions
- [ADR-0002: URL as State Source](0002-use-url-as-state-source.md) - Modal state in URL
- [ADR-0005: Observer Pattern](0005-observer-pattern-for-state.md) - State updates
