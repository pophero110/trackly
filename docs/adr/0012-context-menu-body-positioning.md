# ADR 0012: Position Context Menus at Document Body Level

## Status
Accepted

## Context
Context menus (also called dropdown menus or action menus) appear when users click the "⋮" button on entries or entities. These menus provide actions like Archive and Delete.

Initially, context menus were rendered inline within their parent component's HTML structure. This approach had several problems:

### Problems with Inline Menus
1. **Positioning context issues**: Menus nested in components are subject to parent containers' positioning, overflow, and transform properties
2. **Fixed positioning doesn't work as expected**: `position: fixed` positions relative to nearest positioned ancestor, not viewport
3. **Stacking context interference**: Parent z-index and stacking contexts affect menu layering
4. **Slide panel complications**: Menus inside slide panels had severe positioning issues due to panel transforms
5. **Complex calculation needed**: Required measuring menu dimensions and viewport boundaries for correct positioning

### Specific Issue in Entry Detail
The Entry Detail component opens in a slide panel. When the context menu was rendered inline within the slide panel's HTML:
- Menu appeared in wrong location despite correct coordinates
- Fixed positioning behaved relative to slide panel, not viewport
- Transform and overflow properties from ancestors interfered
- Right-edge alignment calculations were unreliable

## Decision
We will render all context menus at the **document.body level**, not nested within component HTML.

### Implementation Pattern
```typescript
// In render() method:
// 1. Remove old menu if exists
const oldMenu = document.getElementById('menu-id');
if (oldMenu) {
  oldMenu.remove();
}

// 2. Add menu to document.body
const menuHtml = `
  <div class="entry-context-menu" id="menu-id" style="display: none;">
    <div class="context-menu-item" data-action="action1">Action 1</div>
    <div class="context-menu-item" data-action="action2">Action 2</div>
  </div>
`;
document.body.insertAdjacentHTML('beforeend', menuHtml);

// 3. Position using CSS right property (simplest approach)
private toggleMenu(e: MouseEvent): void {
  const menu = document.getElementById('menu-id');
  const button = e.target.closest('.menu-button');
  const rect = button.getBoundingClientRect();

  menu.style.display = 'block';
  menu.style.position = 'fixed';
  menu.style.zIndex = '10000';
  menu.style.right = `${window.innerWidth - rect.right}px`;
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = 'auto';
}

// 4. Clean up in disconnectedCallback()
disconnectedCallback(): void {
  const menu = document.getElementById('menu-id');
  if (menu) {
    menu.remove();
  }
}
```

## Rationale

### Positioning Simplicity
1. **Position relative to viewport**: `position: fixed` works as expected when menu is at body level
2. **No parent interference**: Not affected by parent overflow, transform, or positioning
3. **Simple right-edge alignment**: Use CSS `right` property instead of calculating left position
4. **No dimension measurement needed**: `right = window.innerWidth - rect.right` is simpler than measuring menu width

### Consistency
1. **Same pattern as modals**: Image preview modals already use document.body pattern
2. **Works everywhere**: Same approach for all components (entry cards, entry detail, entities)
3. **Predictable behavior**: Menus always position correctly regardless of parent context

### Code Quality
1. **Less code**: No complex viewport boundary checks needed
2. **No timing issues**: No requestAnimationFrame or layout calculation delays
3. **Reliable**: Works in all scenarios without edge cases

## Design Details

### Menu Positioning Formula
```typescript
// Right-edge alignment (simplest approach)
menu.style.right = `${window.innerWidth - rect.right}px`;
menu.style.top = `${rect.bottom + 4}px`;
menu.style.left = 'auto'; // Clear previous left value
```

This positions the menu's right edge to align with the button's right edge, 4px below the button.

### Alternative (Width Measurement)
```typescript
// Can also use left if needed
menu.style.visibility = 'hidden';
const menuWidth = menu.offsetWidth;
menu.style.visibility = 'visible';
menu.style.left = `${rect.right - menuWidth}px`;
menu.style.top = `${rect.bottom + 4}px`;
```

The right-based approach is simpler and preferred.

### Cleanup
Always remove menus from document.body when:
- Component unmounts (`disconnectedCallback`)
- Component re-renders (before adding new menu)

### Event Handlers
Use `document.getElementById()` instead of `this.querySelector()` since menu is not in component DOM:
```typescript
private attachMenuHandlers(): void {
  const menu = document.getElementById('menu-id');
  if (menu) {
    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Handle action
      });
    });
  }
}
```

## Consequences

### Positive
- **Reliable positioning**: Menus always appear in correct location
- **Works in slide panels**: No positioning issues with transformed parents
- **Simpler code**: Less calculation, no timing issues
- **Consistent pattern**: Same approach everywhere
- **Better performance**: No layout thrashing from dimension measurements
- **Easier debugging**: Menu always at predictable DOM location

### Negative
- **DOM pollution**: Menus live at body level, not semantic parent
- **Extra cleanup needed**: Must remove menus manually on unmount
- **Selector changes**: Use `getElementById` instead of `querySelector`
- **Not encapsulated**: Menu HTML not self-contained in component

### Trade-offs
The positioning benefits far outweigh the minor inconveniences of body-level DOM management.

## Implementation Examples

### Entry Detail Component
- Single menu for one entry
- Menu created in `render()`, removed in `disconnectedCallback()`
- Menu ID: `detail-menu`

### Entry List Component
- Multiple entries, each with potential menu
- Options:
  1. **Current**: One menu per entry (simple but creates N menus for N entries)
  2. **Future**: Single reusable menu repositioned for clicked entry (more efficient)

## Related Patterns

### Image Preview Modal
Already uses document.body pattern:
```typescript
// Image modal also added to body, not component HTML
const modalHtml = `<div class="image-preview-modal">...</div>`;
document.body.insertAdjacentHTML('beforeend', modalHtml);
```

Context menus follow the same architectural pattern.

## Future Considerations

1. **Single reusable menu for lists**: For components with many entries (EntryListComponent), consider using one shared menu that repositions dynamically
2. **Menu animations**: Add subtle fade/scale animations for polish
3. **Smart positioning**: Add viewport boundary detection to show menu above button if no space below
4. **Touch gestures**: Consider long-press behavior for mobile context menus
5. **Accessibility**: Ensure keyboard navigation (arrow keys) and screen reader announcements

## Migration Notes

### Before (Inline Menu)
```typescript
private renderHeader(): string {
  return `
    <div class="header">
      <button id="menu-btn">⋮</button>
    </div>
    <div class="context-menu" id="menu">...</div>
  `;
}
```

### After (Body-Level Menu)
```typescript
private renderHeader(): string {
  return `
    <div class="header">
      <button id="menu-btn">⋮</button>
    </div>
  `;
}

render(): void {
  this.innerHTML = this.renderHeader();

  // Add menu to body
  const menuHtml = `<div class="context-menu" id="menu">...</div>`;
  document.body.insertAdjacentHTML('beforeend', menuHtml);

  this.attachEventHandlers();
}
```

## Related Decisions
- [ADR-0001: Web Components](0001-use-web-components.md) - Component architecture
- [ADR-0008: Centered Modal Pattern](0008-centered-modal-pattern.md) - Similar body-level pattern for modals
