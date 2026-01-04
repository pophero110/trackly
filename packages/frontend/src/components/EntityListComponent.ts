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
  render(): void {
    // Show loading state while data is being fetched
    if (!this.store.getIsLoaded()) {
      this.innerHTML = `
                <div class="section">
                    <div class="section-header-strong">
                        <div class="section-header-content">
                            <div class="section-header-text">
                                <h2 class="section-title">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                                        <rect x="3" y="3" width="7" height="7"></rect>
                                        <rect x="14" y="3" width="7" height="7"></rect>
                                        <rect x="14" y="14" width="7" height="7"></rect>
                                        <rect x="3" y="14" width="7" height="7"></rect>
                                    </svg>
                                    Entities
                                </h2>
                                <p class="section-subtitle">Track what matters to you</p>
                            </div>
                        </div>
                    </div>
                    ${this.renderLoadingState('Loading entities...')}
                </div>
            `;
      return;
    }

    const entities = this.store.getEntities();

    if (entities.length === 0) {
      this.innerHTML = `
                <div class="section">
                    <div class="section-header-strong">
                        <div class="section-header-content">
                            <div class="section-header-text">
                                <h2 class="section-title">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                                        <rect x="3" y="3" width="7" height="7"></rect>
                                        <rect x="14" y="3" width="7" height="7"></rect>
                                        <rect x="14" y="14" width="7" height="7"></rect>
                                        <rect x="3" y="14" width="7" height="7"></rect>
                                    </svg>
                                    Entities
                                </h2>
                                <p class="section-subtitle">Track what matters to you</p>
                            </div>
                            <div class="section-header-actions">
                                <button class="btn btn-primary btn-add-entry" id="create-entity-btn">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                    Create Entity
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="empty-state">No entities yet. Create your first entity to get started!</div>
                </div>
            `;
      this.attachCreateButtonHandler();
      return;
    }

    const entitiesHtml = entities
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(entity => this.renderEntityCard(entity))
      .join('');

    this.innerHTML = `
            <div class="section">
                <div class="section-header-strong">
                    <div class="section-header-content">
                        <div class="section-header-text">
                            <h2 class="section-title">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                                    <rect x="3" y="3" width="7" height="7"></rect>
                                    <rect x="14" y="3" width="7" height="7"></rect>
                                    <rect x="14" y="14" width="7" height="7"></rect>
                                    <rect x="3" y="14" width="7" height="7"></rect>
                                </svg>
                                Entities
                            </h2>
                            <p class="section-subtitle">Track what matters to you</p>
                        </div>
                        <div class="section-header-actions">
                            <button class="btn-primary btn-add-entry" id="create-entity-btn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Create Entity
                            </button>
                        </div>
                    </div>
                </div>
                <div class="entities-list page-grid scrollable-grid">
                    ${entitiesHtml}
                </div>
            </div>
        `;

    // Attach event handlers after rendering
    this.attachCreateButtonHandler();
    this.attachCardClickHandlers();
    this.attachContextMenuHandlers();
  }

  private renderEntityCard(entity: Entity): string {
    const entries = this.store.getEntriesByEntityId(entity.id);
    const selectedId = this.store.getSelectedEntityId();
    const isSelected = selectedId === entity.id;

    // Get most recent entry
    const sortedEntries = entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const mostRecentEntry = sortedEntries.length > 0 ? sortedEntries[0] : null;

    const categoryChips = entity.categories.length > 0
      ? entity.categories.map(cat => `<span class="entity-category-chip">${escapeHtml(cat)}</span>`).join('')
      : '';

    // Calculate entry count
    const entryCount = entries.length;

    return `
            <div class="entity-card ${isSelected ? 'selected' : ''}" data-entity-id="${entity.id}">
                <div class="entity-metadata">
                    <div class="entity-card-header">
                        <div class="entity-header-top">
                            <div class="entity-name-type">
                                <h3>${escapeHtml(entity.name)}</h3>
                                <span class="entity-type ${entity.type.toLowerCase()}">${entity.type}</span>
                                <span class="entity-count">${entryCount}</span>
                            </div>
                            <button class="entity-menu-btn" data-entity-id="${entity.id}" data-action="menu">⋮</button>
                        </div>
                        ${categoryChips ? `<div class="entity-categories">${categoryChips}</div>` : ''}
                    </div>
                </div>
                ${mostRecentEntry ? `
                    <div class="entity-recent-entry">
                        <div class="recent-entry-timestamp">${formatDate(mostRecentEntry.timestamp)}</div>
                        ${mostRecentEntry.value !== undefined ? `<div class="recent-entry-value">${this.formatValue(mostRecentEntry.value, mostRecentEntry.valueDisplay, entity.valueType)}</div>` : ''}
                        ${entity.properties && entity.properties.length > 0 && mostRecentEntry.propertyValues ? this.renderPropertyValues(entity.properties, mostRecentEntry.propertyValues, mostRecentEntry.propertyValueDisplays) : ''}
                        ${mostRecentEntry.notes ? `<div class="recent-entry-notes">${this.formatNotes(mostRecentEntry.notes)}</div>` : ''}
                    </div>
                ` : `
                    <div class="entity-recent-entry">
                        <div class="entity-no-entries">No entries yet</div>
                    </div>
                `}
            </div>
            <div class="entity-context-menu" id="entity-menu-${entity.id}" style="display: none;">
                <div class="context-menu-item" data-entity-id="${entity.id}" data-action="log-entry">Log</div>
                <div class="context-menu-item" data-entity-id="${entity.id}" data-action="edit">Edit</div>
                <div class="context-menu-item" data-entity-id="${entity.id}" data-action="clone">Clone</div>
                <div class="context-menu-item danger" data-entity-id="${entity.id}" data-action="delete">Delete</div>
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
        const target = e.target as HTMLElement;
        const entityId = target.dataset.entityId;
        const action = target.dataset.action;

        if (entityId && action) {
          this.handleContextMenuAction(action, entityId);
        }
        this.hideAllMenus();
      });
    });

    // Click outside to close menus
    document.addEventListener('click', () => this.hideAllMenus());
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
}
