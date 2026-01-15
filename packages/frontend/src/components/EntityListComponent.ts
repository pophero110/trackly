import { WebComponent } from './WebComponent.js';
import { Entity } from '../models/Entity.js';
import { escapeHtml, formatDate } from '../utils/helpers.js';
import { parseMarkdown } from '../utils/markdown.js';
import { URLStateManager } from '../utils/urlState.js';
import { EntityProperty } from '../types/index.js';

/**
 * EntityList Web Component for displaying entities in a grid layout on the home page
 */
export class EntityListComponent extends WebComponent {
  private documentClickHandler: (() => void) | null = null;

  render(): void {
    // Show loading state while data is being fetched
    if (!this.store.getIsLoaded()) {
      this.innerHTML = `
                <div class="section">
                    ${this.renderLoadingState('Loading entities...')}
                </div>
            `;
      return;
    }

    // Get current sort values from URL
    const currentSortBy = URLStateManager.getEntitySortBy() || 'created';
    const currentSortOrder = URLStateManager.getEntitySortOrder() || 'desc';
    const entities = this.sortEntities(this.store.getEntities(), currentSortBy, currentSortOrder);

    // Sort options
    const sortOptions = [
      { value: 'created-desc', label: 'Newest First' },
      { value: 'created-asc', label: 'Oldest First' },
      { value: 'name-asc', label: 'Name (A-Z)' },
      { value: 'name-desc', label: 'Name (Z-A)' },
      { value: 'entries-desc', label: 'Most Entries' },
      { value: 'entries-asc', label: 'Least Entries' },
      { value: 'type-asc', label: 'Type' }
    ];

    const currentSortValue = `${currentSortBy}-${currentSortOrder}`;
    const currentSortLabel = sortOptions.find(opt => opt.value === currentSortValue)?.label || 'Newest First';

    // Sort select dropdown
    const sortSelect = `
      <div class="tag-filter-container">
        <button class="btn-tag-filter" id="sort-filter-btn" title="Sort by">
          <i class="ph-duotone ph-sort-ascending"></i>
          <span>${currentSortLabel}</span>
        </button>
        <div class="tag-filter-menu" id="sort-filter-menu" style="display: none;">
          ${sortOptions.map(opt => `
            <label class="tag-filter-option">
              <input type="radio" name="entity-sort-option" value="${opt.value}" ${opt.value === currentSortValue ? 'checked' : ''}>
              <span>${escapeHtml(opt.label)}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;

    if (entities.length === 0) {
      this.innerHTML = `
                <div class="section">
                    <div class="section-header-actions">
                        <button class="btn btn-primary btn-add-entry" id="create-entity-btn">
                            <i class="ph ph-plus"></i>
                            Create Entity
                        </button>
                    </div>
                    <div class="empty-state">No entities yet. Create your first entity to get started!</div>
                </div>
            `;
      this.attachCreateButtonHandler();
      return;
    }

    const entitiesHtml = entities
      .map(entity => this.renderEntityCard(entity))
      .join('');

    this.innerHTML = `
            <div class="section">
                <div class="section-header-actions">
                    ${sortSelect}
                    <button class="btn-primary btn-add-entry" id="create-entity-btn">
                        <i class="ph ph-plus"></i>
                        Create Entity
                    </button>
                </div>
                <div class="page-grid">
                    ${entitiesHtml}
                </div>
            </div>
        `;

    // Attach event handlers after rendering
    this.attachCreateButtonHandler();
    this.attachSortHandler();
    this.attachCardClickHandlers();
    this.attachContextMenuHandlers();
  }

  private getBentoSize(entity: Entity, totalEntries: number, mostRecentEntry: any): string {
    // Determine size based on multiple factors:
    // 1. High entry count = larger boxes
    // 2. Recent activity = larger boxes
    // 3. Recency decay = older entities get smaller

    const now = new Date();
    const daysSinceLastEntry = mostRecentEntry
      ? (now.getTime() - new Date(mostRecentEntry.timestamp).getTime()) / (1000 * 60 * 60 * 24)
      : 999;

    // Calculate importance score
    let score = 0;

    // Entry count scoring (0-40 points)
    if (totalEntries >= 50) score += 40;
    else if (totalEntries >= 20) score += 30;
    else if (totalEntries >= 10) score += 20;
    else if (totalEntries >= 5) score += 10;

    // Recency scoring (0-40 points)
    if (daysSinceLastEntry <= 1) score += 40; // Today or yesterday
    else if (daysSinceLastEntry <= 7) score += 30; // This week
    else if (daysSinceLastEntry <= 30) score += 20; // This month
    else if (daysSinceLastEntry <= 90) score += 10; // Last 3 months

    // Type scoring (0-20 points) - prioritize certain types
    if (entity.type === 'Tracking') score += 15;
    else if (entity.type === 'Task') score += 10;
    else if (entity.type === 'Journal') score += 10;

    // Map score to Bento size
    // large: 80+ points (2x2 grid)
    // wide: 50-79 points (2x1 grid)
    // tall: 30-49 points (1x2 grid)
    // small: 0-29 points (1x1 grid)

    if (score >= 80) return 'large';
    if (score >= 50) return 'wide';
    if (score >= 30) return 'tall';
    return 'small';
  }

  private renderEntityCard(entity: Entity): string {
    const entries = this.store.getEntriesByEntityId(entity.id, true);
    const selectedId = this.store.getSelectedEntityId();
    const isSelected = selectedId === entity.id;

    // Get most recent entry
    const sortedEntries = entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const mostRecentEntry = sortedEntries.length > 0 ? sortedEntries[0] : null;

    const categoryChips = entity.categories.length > 0
      ? entity.categories.map(cat => `<span class="entity-category-chip">${escapeHtml(cat)}</span>`).join('')
      : '';

    // Calculate entry counts
    const activeEntries = entries.filter(e => !e.isArchived);
    const archivedEntries = entries.filter(e => e.isArchived);
    const entryCount = activeEntries.length;
    const archivedCount = archivedEntries.length;

    const totalEntries = entryCount + archivedCount;
    const activePercent = totalEntries > 0 ? (entryCount / totalEntries) * 100 : 0;
    const archivedPercent = totalEntries > 0 ? (archivedCount / totalEntries) * 100 : 0;

    // Determine Bento size based on importance
    const bentoSize = this.getBentoSize(entity, totalEntries, mostRecentEntry);

    return `
            <div class="entity-card bento-${bentoSize} ${isSelected ? 'selected' : ''}" data-entity-id="${entity.id}">
                <div class="entity-card-header">
                    <div class="entity-name-type">
                        <h3>${escapeHtml(entity.name)}</h3>
                        <span class="entity-type ${entity.type.toLowerCase()}">${entity.type}</span>
                    </div>
                    <button class="entity-menu-btn" data-entity-id="${entity.id}" data-action="menu">⋮</button>
                    ${categoryChips ? `<div class="entity-categories">${categoryChips}</div>` : ''}
                    ${totalEntries > 0 ? `
                        <div class="entity-stats-bar">
                            <div class="stats-bar-container">
                                <div class="stats-bar-fill stats-bar-active" style="width: ${activePercent}%"></div>
                                <div class="stats-bar-fill stats-bar-archived" style="width: ${archivedPercent}%"></div>
                            </div>
                            <div class="stats-bar-labels">
                                <span class="stats-label-active">${entryCount} active</span>
                                ${archivedCount > 0 ? `<span class="stats-label-archived">${archivedCount} archived</span>` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="entity-context-menu" id="entity-menu-${entity.id}" style="display: none;">
                <div class="context-menu-item" data-entity-id="${entity.id}" data-action="log-entry">
                    <i class="ph-duotone ph-list-plus"></i>
                    <span>Log</span>
                </div>
                <div class="context-menu-item" data-entity-id="${entity.id}" data-action="edit">
                    <i class="ph-duotone ph-pencil-simple"></i>
                    <span>Edit</span>
                </div>
                <div class="context-menu-item" data-entity-id="${entity.id}" data-action="clone">
                    <i class="ph-duotone ph-copy"></i>
                    <span>Clone</span>
                </div>
                <div class="context-menu-item danger" data-entity-id="${entity.id}" data-action="delete">
                    <i class="ph-duotone ph-trash"></i>
                    <span>Delete</span>
                </div>
            </div>
        `;
  }

  private renderPropertyValues(properties: EntityProperty[], propertyValues: Record<string, string | number | boolean>, propertyValueDisplays?: Record<string, string>): string {
    const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

    const propertyItems = properties
      .filter(prop => propertyValues[prop.id] !== undefined && propertyValues[prop.id] !== '')
      .map(prop => {
        const value = propertyValues[prop.id];
        const displayValue = propertyValueDisplays?.[prop.id];
        const formattedValue = this.formatPropertyValue(value, prop.valueType, displayValue);
        return `
                    <div class="property-value-item-compact">
                        <span class="property-label-compact">${escapeHtml(capitalizeFirstLetter(prop.name))}:</span>
                        <span class="property-value-compact">${formattedValue}</span>
                    </div>
                `;
      })
      .join('');

    if (!propertyItems) return '';

    return `<div class="entity-properties-compact">${propertyItems}</div>`;
  }

  private formatPropertyValue(value: string | number | boolean, valueType: string, displayValue?: string): string {
    const valueStr = String(value);

    // Handle different value types
    if (valueType === 'checkbox') {
      return value === true || value === 'true' ? '✓' : '✗';
    }

    if (valueType === 'url') {
      // Use displayValue (fetched title) if available, otherwise use URL
      // Truncate long titles/URLs for grid display
      const linkText = displayValue || valueStr;
      const truncatedText = linkText.length > 25 ? linkText.substring(0, 25) + '...' : linkText;
      return `<a href="${escapeHtml(valueStr)}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">${escapeHtml(truncatedText)}</a>`;
    }

    if (valueType === 'duration') {
      return `${valueStr} min`;
    }

    if (valueType === 'rating') {
      return `${valueStr}/5`;
    }

    if (valueType === 'date' || valueType === 'time') {
      return escapeHtml(valueStr);
    }

    // Default: escape and truncate if too long
    const displayText = valueStr.length > 30 ? valueStr.substring(0, 30) + '...' : valueStr;
    return escapeHtml(displayText);
  }

  private formatNotes(notes: string): string {
    return parseMarkdown(notes);
  }

  private formatValue(value: string | number | boolean, displayValue?: string, valueType?: string): string {
    const valueStr = String(value);

    // For entity cards, show simplified version for media
    if (valueStr.startsWith('http://') || valueStr.startsWith('https://')) {
      // Image - show thumbnail
      if (valueStr.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) {
        return `<img src="${escapeHtml(valueStr)}" alt="Preview" style="max-width: 100px; max-height: 60px; border-radius: 4px; object-fit: cover;">`;
      }
      // Audio/Video - show icon
      if (valueStr.match(/\.(mp3|wav|ogg|m4a|mp4|webm|ogv)(\?|$)/i)) {
        return '🎵 Media';
      }
      // Hyperlink - use displayValue if available, otherwise show hostname
      let linkText: string;
      if (displayValue) {
        linkText = displayValue.length > 40 ? displayValue.substring(0, 40) + '...' : displayValue;
      } else {
        const urlObj = new URL(valueStr);
        linkText = urlObj.hostname;
      }
      return `<a href="${escapeHtml(valueStr)}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">${escapeHtml(linkText)}</a>`;
    }

    // Check if value contains [[title::url]] format (for text values with fetched titles)
    if (valueStr.includes('[[') && valueStr.includes('::')) {
      return this.formatNotes(valueStr);
    }

    // Check if it's a select option value (e.g., task status, decision, goal, plan)
    if (valueStr === 'todo' || valueStr === 'in-progress' || valueStr === 'done' || valueStr === 'yes' || valueStr === 'no' || valueStr === 'pending' || valueStr === 'not-started' || valueStr === 'completed' || valueStr === 'draft' || valueStr === 'active' || valueStr === 'on-hold') {
      let displayText = valueStr;
      if (valueStr === 'in-progress') displayText = 'In Progress';
      else if (valueStr === 'todo') displayText = 'To Do';
      else if (valueStr === 'done') displayText = 'Done';
      else if (valueStr === 'yes') displayText = 'Yes';
      else if (valueStr === 'no') displayText = 'No';
      else if (valueStr === 'pending') displayText = 'Pending';
      else if (valueStr === 'not-started') displayText = 'Not Started';
      else if (valueStr === 'completed') displayText = 'Completed';
      else if (valueStr === 'draft') displayText = 'Draft';
      else if (valueStr === 'active') displayText = 'Active';
      else if (valueStr === 'on-hold') displayText = 'On Hold';
      return `<span class="status-badge ${valueStr}">${displayText}</span>`;
    }

    // Check if it's a boolean/checkbox value
    if (valueStr === 'true' || valueStr === 'false') {
      return valueStr === 'true' ? '✓' : '✗';
    }

    // Check if it's a color value
    if (valueStr.match(/^#[0-9A-Fa-f]{6}$/)) {
      return `<div style="width: 20px; height: 20px; background: ${valueStr}; border: 1px solid #ccc; border-radius: 4px;"></div>`;
    }

    // Check if it's a date/time value (ISO format) - show shortened version for grid
    if (valueStr.match(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/)) {
      try {
        const date = new Date(valueStr);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString();
        }
      } catch {
        // Not a valid date, fall through
      }
    }

    // Add units for numeric value types
    if (valueType) {
      const numValue = Number(valueStr);
      if (!isNaN(numValue)) {
        if (valueType === 'duration') {
          return `${valueStr} min`;
        } else if (valueType === 'rating') {
          return `${valueStr}/5`;
        }
      }
    }

    return escapeHtml(valueStr);
  }

  private attachCreateButtonHandler(): void {
    const createBtn = this.querySelector('#create-entity-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        URLStateManager.openCreateEntityPanel();
      });
    }
  }

  private attachCardClickHandlers(): void {
    this.querySelectorAll('.entity-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;

        // Don't trigger if clicking on menu button
        if (target.closest('[data-action="menu"]')) {
          return;
        }

        const entityId = (card as HTMLElement).dataset.entityId;
        if (entityId) {
          const entity = this.store.getEntityById(entityId);
          if (entity) {
            URLStateManager.showEntryList(entity.name);
          }
        }
      });

      // Right-click to show context menu
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.target as HTMLElement;

        // Don't trigger if clicking on menu button
        if (target.closest('[data-action="menu"]')) {
          return;
        }

        const entityId = (card as HTMLElement).dataset.entityId;
        if (entityId) {
          this.toggleMenu(entityId, e as MouseEvent);
        }
      });
    });
  }

  private handleDelete(entityId: string): void {
    const entity = this.store.getEntityById(entityId);
    if (!entity) return;

    if (!confirm(`Are you sure you want to delete "${entity.name}"? All related entries will also be deleted.`)) {
      return;
    }

    try {
      this.store.deleteEntity(entityId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error deleting entity: ${message}`);
    }
  }

  private attachContextMenuHandlers(): void {
    // Menu button click
    this.querySelectorAll('[data-action="menu"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.target as HTMLElement;
        const entityId = target.dataset.entityId;
        if (entityId) {
          this.toggleMenu(entityId, e as MouseEvent);
        }
      });
    });

    // Menu item clicks
    this.querySelectorAll('.entity-context-menu .context-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation(); // Stop propagation to prevent document click
        const target = e.target as HTMLElement;
        // Find the menu item (in case user clicked on icon or span)
        const menuItem = target.closest('.context-menu-item') as HTMLElement;
        if (!menuItem) return;

        const entityId = menuItem.dataset.entityId;
        const action = menuItem.dataset.action;

        if (entityId && action) {
          this.handleContextMenuAction(action, entityId);
        }
        this.hideAllMenus();
      });
    });

    // Click on menu itself should not close it
    this.querySelectorAll('.entity-context-menu').forEach(menu => {
      menu.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });

    // Click outside to close menus
    // Remove old listener if exists
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
    }

    // Add new listener
    this.documentClickHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      // Check if click is outside menu and menu button
      if (!target.closest('.entity-context-menu') && !target.closest('[data-action="menu"]')) {
        this.hideAllMenus();
      }
    };
    document.addEventListener('click', this.documentClickHandler);
  }

  private toggleMenu(entityId: string, e: MouseEvent): void {
    const menu = this.querySelector(`#entity-menu-${entityId}`) as HTMLElement;
    if (!menu) return;

    // Hide all other menus first
    this.hideAllMenus();

    // Position and show this menu
    menu.style.display = 'block';
    menu.style.position = 'fixed';

    // Check if event came from menu button click
    const target = e.target as HTMLElement;
    const menuButton = target.closest('[data-action="menu"]') as HTMLElement;

    if (menuButton) {
      // Menu button click - align menu's right edge with button's right edge
      const rect = menuButton.getBoundingClientRect();

      // Temporarily show menu to get its dimensions
      menu.style.visibility = 'hidden';
      const menuWidth = menu.offsetWidth;
      menu.style.visibility = 'visible';

      menu.style.left = `${rect.right - menuWidth}px`;
      menu.style.top = `${rect.bottom + 4}px`;
    } else {
      // Right-click - show at cursor position
      menu.style.left = `${e.clientX}px`;
      menu.style.top = `${e.clientY}px`;
    }
  }

  private hideAllMenus(): void {
    this.querySelectorAll('.entity-context-menu').forEach(menu => {
      (menu as HTMLElement).style.display = 'none';
    });
  }

  private handleContextMenuAction(action: string, entityId: string): void {
    if (action === 'delete') {
      this.handleDelete(entityId);
    } else if (action === 'edit') {
      this.handleEdit(entityId);
    } else if (action === 'clone') {
      this.handleClone(entityId);
    } else if (action === 'log-entry') {
      this.handleLogEntry(entityId);
    }
  }

  private handleEdit(entityId: string): void {
    const entity = this.store.getEntityById(entityId);
    if (!entity) return;

    URLStateManager.openEditEntityPanel(entity.name);
  }

  private handleClone(entityId: string): void {
    const entity = this.store.getEntityById(entityId);
    if (!entity) return;

    URLStateManager.openCloneEntityPanel(entity.name);
  }

  private handleLogEntry(entityId: string): void {
    const entity = this.store.getEntityById(entityId);
    if (!entity) return;

    URLStateManager.openLogEntryPanel(entity.name);
  }

  private sortEntities(entities: Entity[], sortBy: string, sortOrder: 'asc' | 'desc'): Entity[] {
    const sorted = [...entities];

    switch (sortBy) {
      case 'created':
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return sortOrder === 'desc' ? sorted.reverse() : sorted;

      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        return sortOrder === 'desc' ? sorted.reverse() : sorted;

      case 'entries':
        sorted.sort((a, b) => {
          const aEntries = this.store.getEntriesByEntityId(a.id, false).length;
          const bEntries = this.store.getEntriesByEntityId(b.id, false).length;
          return aEntries - bEntries;
        });
        return sortOrder === 'desc' ? sorted.reverse() : sorted;

      case 'type':
        sorted.sort((a, b) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name);
          }
          return a.type.localeCompare(b.type);
        });
        return sortOrder === 'desc' ? sorted.reverse() : sorted;

      default:
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return sorted;
    }
  }

  private attachSortHandler(): void {
    // Toggle sort filter menu
    const filterBtn = this.querySelector('#sort-filter-btn');
    const filterMenu = this.querySelector('#sort-filter-menu') as HTMLElement;

    if (filterBtn && filterMenu) {
      // Toggle menu on button click
      filterBtn.addEventListener('click', () => {
        const isVisible = filterMenu.style.display === 'block';
        filterMenu.style.display = isVisible ? 'none' : 'block';
      });

      // Handle sort option selection
      const radioButtons = filterMenu.querySelectorAll('input[type="radio"]');
      radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
          const value = (e.target as HTMLInputElement).value;
          const [sortBy, sortOrder] = value.split('-') as [string, 'asc' | 'desc'];
          // Update URL - this will trigger re-render
          URLStateManager.setEntitySort(sortBy, sortOrder);
          // Close the menu after selection
          filterMenu.style.display = 'none';
        });
      });

      // Close menu when clicking outside
      document.addEventListener('click', (e) => {
        if (!filterBtn.contains(e.target as Node) && !filterMenu.contains(e.target as Node)) {
          filterMenu.style.display = 'none';
        }
      });
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Clean up document click listener
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
      this.documentClickHandler = null;
    }
  }
}
