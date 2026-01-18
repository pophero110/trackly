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
  private sortMenuCloseHandler: ((e: Event) => void) | null = null;

  // Helper to turn HTML strings into DOM nodes efficiently
  private createTemplate(html: string): DocumentFragment {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content;
  }

  render(): void {
    // Show loading state while data is being fetched
    if (!this.store.getIsLoaded()) {
      const loadingFragment = this.createTemplate(`
        <div class="section">
          ${this.renderLoadingState('Loading entities...')}
        </div>
      `);
      this.replaceChildren(loadingFragment);
      return;
    }

    // Get current sort values from URL
    const currentSortBy = URLStateManager.getEntitySortBy() || 'entries';
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
      const emptyFragment = this.createTemplate(`
        <div class="section">
          <div class="section-header-actions">
            <button class="btn btn-primary" id="create-entity-btn">
              <i class="ph ph-plus"></i>
              Create Entity
            </button>
          </div>
          <div class="empty-state">No entities yet. Create your first entity to get started!</div>
        </div>
      `);
      this.replaceChildren(emptyFragment);
      this.attachCreateButtonHandler();
      return;
    }

    const entitiesHtml = entities
      .map(entity => this.renderEntityCard(entity))
      .join('');

    const mainFragment = this.createTemplate(`
      <div class="section">
        <div class="section-header-actions">
          ${sortSelect}
          <button class="btn-primary" id="create-entity-btn">
            <i class="ph ph-plus"></i>
            Create Entity
          </button>
        </div>
        <div class="page-grid">
          ${entitiesHtml}
        </div>
      </div>
    `);
    this.replaceChildren(mainFragment);

    // Attach event handlers after rendering
    this.attachCreateButtonHandler();
    this.attachSortHandler();
    this.attachCardClickHandlers();
    this.attachContextMenuHandlers();
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


    return `
            <div class="entity-card ${isSelected ? 'selected' : ''}" data-entity-id="${entity.id}">
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
        // Cache entry counts to avoid repeated lookups
        const entryCounts = new Map<string, number>();
        sorted.forEach(entity => {
          entryCounts.set(entity.id, this.store.getEntriesByEntityId(entity.id, false).length);
        });
        sorted.sort((a, b) => {
          return (entryCounts.get(a.id) || 0) - (entryCounts.get(b.id) || 0);
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

      // Remove old listener if it exists
      if (this.sortMenuCloseHandler) {
        document.removeEventListener('click', this.sortMenuCloseHandler);
      }

      // Create and store new handler
      this.sortMenuCloseHandler = (e: Event) => {
        if (!filterBtn.contains(e.target as Node) && !filterMenu.contains(e.target as Node)) {
          filterMenu.style.display = 'none';
        }
      };

      // Close menu when clicking outside
      document.addEventListener('click', this.sortMenuCloseHandler);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Clean up document click listeners
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
      this.documentClickHandler = null;
    }
    if (this.sortMenuCloseHandler) {
      document.removeEventListener('click', this.sortMenuCloseHandler);
      this.sortMenuCloseHandler = null;
    }
  }
}
