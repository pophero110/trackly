# ADR 0011: Use ResizeObserver for Dynamic Truncation Detection

## Status
Accepted

## Context
Entry cards have a maximum height with overflow hidden and a fade-out gradient applied when content is truncated. Initially, truncation detection only ran once when the component rendered. This meant the gradient wouldn't update when:

- User resizes the browser window
- Mobile device orientation changes
- Sidebar or filter panels expand/collapse
- Container dimensions change for any reason

We needed a solution that would:
- Dynamically detect when entry cards resize
- Update truncation state and gradient visibility in real-time
- Work across different viewport sizes and orientations
- Maintain good performance with multiple entry cards

## Decision
We will use **ResizeObserver API** to monitor entry card size changes and re-check truncation when cards resize.

## Rationale

### Accuracy
1. **Element-level detection**: Observes actual entry card dimensions, not just window size
2. **Multiple triggers**: Detects changes from any source (window resize, container changes, dynamic content)
3. **Precise measurements**: Uses browser's native resize detection mechanism

### Automatic Updates
1. **Real-time response**: Updates immediately when cards resize
2. **No manual coordination**: Works automatically without explicit event coordination
3. **Handles edge cases**: Catches resize events from sources we might not anticipate

### Modern API
1. **Built for this use case**: Designed specifically for element resize detection
2. **Performance optimized**: Browser-native implementation with efficient batching
3. **Clean API**: Simple observer pattern, no debouncing logic needed

## Alternatives Considered

### 1. Window Resize Listener
**Approach**: Single `window.addEventListener('resize')` listener

**Pros**:
- Simpler implementation
- Lower memory footprint (one listener vs observer per element)
- Lighter CPU usage
- Easier to debug

**Cons**:
- Only detects viewport changes
- Misses container-based resizes (sidebar collapse, filter expansion)
- Misses dynamic content changes
- Less accurate for element-specific sizing

**Decision**: Rejected for lower accuracy. Entry cards could resize without window changes.

### 2. Debounced Window Resize
**Approach**: Window resize listener with debouncing (e.g., 150ms delay)

**Pros**:
- Reduces check frequency during rapid resize
- Better performance than immediate checks
- Still simple to implement

**Cons**:
- Still only detects window resizes
- Introduces delay (gradient appears late)
- Requires additional debounce utility
- Missed updates during debounce period

**Decision**: Rejected. Added complexity without solving the core limitation.

### 3. Intersection Observer
**Approach**: Use IntersectionObserver to detect visibility changes

**Pros**:
- Good for viewport entry/exit detection
- Efficient for lazy loading use cases
- Built-in threshold support

**Cons**:
- Wrong tool for the job (detects visibility, not size)
- Doesn't detect resize events
- Requires threshold configuration
- More complex than needed

**Decision**: Rejected. Not designed for resize detection.

### 4. Manual Check on Every State Update
**Approach**: Call `detectTruncatedContent()` whenever state changes

**Pros**:
- Explicit control over when checks happen
- No observer overhead
- Simple to understand

**Cons**:
- Easy to miss cases (what triggers state updates?)
- Requires coordination across components
- Brittle (breaks when new state changes added)
- Doesn't detect external triggers (CSS changes, font loading)

**Decision**: Rejected. Too fragile and easy to miss edge cases.

## Implementation Details

### Component Structure
```typescript
export class EntryListComponent extends WebComponent {
    private resizeObserver: ResizeObserver | null = null;

    render(): void {
        // ... render entry cards
        this.detectTruncatedContent();  // Initial check
        this.setupResizeObserver();      // Start monitoring
    }

    private setupResizeObserver(): void {
        // Clean up existing observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        // Create observer that re-checks truncation on resize
        this.resizeObserver = new ResizeObserver(() => {
            this.detectTruncatedContent();
        });

        // Observe all entry cards
        this.querySelectorAll('.entry-card').forEach(card => {
            this.resizeObserver!.observe(card as HTMLElement);
        });
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        // Clean up to prevent memory leaks
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
    }
}
```

### Truncation Detection Logic
```typescript
private detectTruncatedContent(): void {
    this.querySelectorAll('.entry-content').forEach(contentEl => {
        const element = contentEl as HTMLElement;
        // Compare scrollHeight (total content) vs clientHeight (visible area)
        if (element.scrollHeight > element.clientHeight) {
            element.classList.add('is-truncated');
        } else {
            element.classList.remove('is-truncated');
        }
    });
}
```

### CSS Integration
```css
/* Gradient only shows when content is truncated */
.entry-content.is-truncated::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 40px;
    background: linear-gradient(to bottom, transparent, var(--card-background));
    pointer-events: none;
}
```

## Consequences

### Positive
- **Accurate**: Detects all resize events, not just window changes
- **Automatic**: No manual event coordination needed
- **Future-proof**: Handles new resize triggers we haven't considered
- **Clean code**: Observer pattern matches Web Components lifecycle
- **User experience**: Gradient appears/disappears correctly on resize

### Negative
- **Performance overhead**: Observer callback runs on every resize
  - With 20 max entries, this is negligible
  - Could be optimized with debouncing if needed later
- **Memory usage**: Observer instance + listeners per observed element
  - Cleaned up properly in `disconnectedCallback()`
- **Browser compatibility**: IE not supported
  - Acceptable - modern browsers only (Safari 13+, Chrome 64+, Firefox 69+)
- **Complexity**: More code than simple window listener
  - Justified by improved accuracy and future-proofing

### Performance Considerations
- **Current scale**: Max 20 entries displayed (`maxEntries: 20`)
- **Callback frequency**: Fires during resize drag (multiple times per second)
- **Work per callback**: Checks 20 elements, compares two numbers each
- **Measured impact**: Negligible on modern devices
- **Future optimization**: Could add debouncing if entry count increases significantly

### Known Limitations
1. **No debouncing**: Checks run immediately on every resize
   - Pro: Instant visual feedback
   - Con: More frequent checks during window drag
   - Mitigation: Limited to 20 entries, minimal work per check

2. **All cards checked**: Every resize checks all cards, not just changed ones
   - Pro: Simple, ensures consistency
   - Con: Checks cards that didn't change
   - Mitigation: Comparison is cheap (scrollHeight vs clientHeight)

## Browser Support

| Browser | Version | ResizeObserver Support |
|---------|---------|------------------------|
| Chrome  | 64+     | ✅ Full support |
| Firefox | 69+     | ✅ Full support |
| Safari  | 13.1+   | ✅ Full support |
| Edge    | 79+     | ✅ Full support |
| IE 11   | -       | ❌ Not supported |

**Decision**: Acceptable. Trackly targets modern browsers.

## Future Optimizations

### If Performance Becomes Issue
1. **Debouncing**: Add 100-150ms debounce to reduce check frequency
   ```typescript
   const debouncedDetect = debounce(() => {
       this.detectTruncatedContent();
   }, 150);

   this.resizeObserver = new ResizeObserver(debouncedDetect);
   ```

2. **IntersectionObserver hybrid**: Only observe visible cards
   ```typescript
   // Only observe cards in viewport
   const intersectionObserver = new IntersectionObserver(entries => {
       entries.forEach(entry => {
           if (entry.isIntersecting) {
               resizeObserver.observe(entry.target);
           } else {
               resizeObserver.unobserve(entry.target);
           }
       });
   });
   ```

3. **RequestAnimationFrame batching**: Batch checks to next frame
   ```typescript
   let rafId: number | null = null;

   this.resizeObserver = new ResizeObserver(() => {
       if (rafId) cancelAnimationFrame(rafId);
       rafId = requestAnimationFrame(() => {
           this.detectTruncatedContent();
       });
   });
   ```

### If Entry Count Grows
- Consider virtual scrolling (only render visible entries)
- Paginate entries beyond 50-100 items
- Implement "Load More" instead of observing all cards

## Testing Scenarios

### Manual Testing
1. ✅ Resize browser window → gradient updates
2. ✅ Mobile orientation change → gradient updates
3. ✅ Zoom in/out → gradient updates
4. ✅ Filter expansion/collapse → gradient updates (if applicable)
5. ✅ Dynamic content load → gradient updates

### Edge Cases
1. ✅ Component disconnect → observer cleaned up
2. ✅ Re-render → old observer disconnected, new one created
3. ✅ Empty entry list → no errors
4. ✅ Single short entry → no gradient (not truncated)

## Related Decisions
- [ADR-0001: Web Components](0001-use-web-components.md) - Lifecycle hooks for cleanup
- [ADR-0005: Observer Pattern](0005-observer-pattern-for-state.md) - Related pattern for state

## References
- [MDN: ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)
- [Can I Use: ResizeObserver](https://caniuse.com/resizeobserver)
- [Web.dev: ResizeObserver](https://web.dev/resize-observer/)
