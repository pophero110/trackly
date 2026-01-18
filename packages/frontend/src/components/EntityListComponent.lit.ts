import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { LitBaseComponent } from './LitBaseComponent.js';
import { Entity } from '../models/Entity.js';
import { escapeHtml } from '../utils/helpers.js';
import { URLStateManager } from '../utils/urlState.js';
import { storeRegistry } from '../state/StoreRegistry.js';

/**
 * EntityList Lit Component for displaying entities in a grid layout
 * Lit version of the original EntityListComponent
 */
@customElement('entity-list')
export class EntityListComponent extends LitBaseComponent {
  @state()
  private openMenuId: string | null = null;

  @state()
  private menuPosition: { x: number; y: number } = { x: 0, y: 0 };

  private documentClickHandler: ((e: Event) => void) | null = null;
  private sortMenuCloseHandler: ((e: Event) => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.attachDocumentListeners();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeDocumentListeners();
  }

  private attachDocumentListeners(): void {
    // Click outside to close menus
    this.documentClickHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.entity-context-menu') && !target.closest('[data-action="menu"]')) {
        this.openMenuId = null;
      }
    };
    document.addEventListener('click', this.documentClickHandler);
  }

  private removeDocumentListeners(): void {
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
      this.documentClickHandler = null;
    }
    if (this.sortMenuCloseHandler) {
      document.removeEventListener('click', this.sortMenuCloseHandler);
      this.sortMenuCloseHandler = null;
    }
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

  private handleCreateClick = (): void => {
    URLStateManager.openCreateEntityPanel();
  };

  private handleCardClick = (e: MouseEvent, entityId: string): void => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-action="menu"]')) {
      return;
    }

    const entity = this.store.getEntityById(entityId);
    if (entity) {
      URLStateManager.showEntryList(entity.name);
    }
  };

  private handleCardContextMenu = (e: MouseEvent, entityId: string): void => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    if (target.closest('[data-action="menu"]')) {
      return;
    }

    this.toggleMenu(entityId, e);
  };

  private handleMenuButtonClick = (e: MouseEvent, entityId: string): void => {
    e.stopPropagation();
    this.toggleMenu(entityId, e);
  };

  private toggleMenu(entityId: string, e: MouseEvent): void {
    if (this.openMenuId === entityId) {
      this.openMenuId = null;
    } else {
      this.openMenuId = entityId;

      const target = e.target as HTMLElement;
      const menuButton = target.closest('[data-action="menu"]') as HTMLElement;

      if (menuButton) {
        // Menu button click - position relative to button
        const rect = menuButton.getBoundingClientRect();
        this.menuPosition = { x: rect.right, y: rect.bottom + 4 };
      } else {
        // Right-click - position at cursor
        this.menuPosition = { x: e.clientX, y: e.clientY };
      }
    }
  }

  private handleContextMenuAction = (e: MouseEvent, action: string, entityId: string): void => {
    e.stopPropagation();
    this.openMenuId = null;

    switch (action) {
      case 'delete':
        this.handleDelete(entityId);
        break;
      case 'edit':
        this.handleEdit(entityId);
        break;
      case 'clone':
        this.handleClone(entityId);
        break;
      case 'log-entry':
        this.handleLogEntry(entityId);
        break;
    }
  };

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

  private handleSortChange = (e: Event): void => {
    const value = (e.target as HTMLInputElement).value;
    const [sortBy, sortOrder] = value.split('-') as [string, 'asc' | 'desc'];
    URLStateManager.setEntitySort(sortBy, sortOrder);
  };

  private renderEntityCard(entity: Entity) {
    const entries = this.store.getEntriesByEntityId(entity.id, true);
    const selectedId = this.store.getSelectedEntityId();
    const isSelected = selectedId === entity.id;

    const activeEntries = entries.filter(e => !e.isArchived);
    const archivedEntries = entries.filter(e => e.isArchived);
    const entryCount = activeEntries.length;
    const archivedCount = archivedEntries.length;
    const totalEntries = entryCount + archivedCount;
    const activePercent = totalEntries > 0 ? (entryCount / totalEntries) * 100 : 0;
    const archivedPercent = totalEntries > 0 ? (archivedCount / totalEntries) * 100 : 0;

    return html`
      <div class="entity-card ${isSelected ? 'selected' : ''}"
           data-entity-id="${entity.id}"
           @click=${(e: MouseEvent) => this.handleCardClick(e, entity.id)}
           @contextmenu=${(e: MouseEvent) => this.handleCardContextMenu(e, entity.id)}>
        <div class="entity-card-header">
          <div class="entity-name-type">
            <h3>${escapeHtml(entity.name)}</h3>
            <span class="entity-type ${entity.type.toLowerCase()}">${entity.type}</span>
          </div>
          <button class="entity-menu-btn"
                  data-entity-id="${entity.id}"
                  data-action="menu"
                  @click=${(e: MouseEvent) => this.handleMenuButtonClick(e, entity.id)}>⋮</button>
          ${when(
      entity.categories.length > 0,
      () => html`
              <div class="entity-categories">
                ${map(entity.categories, cat => html`
                  <span class="entity-category-chip">${escapeHtml(cat)}</span>
                `)}
              </div>
            `
    )}
          ${when(
      totalEntries > 0,
      () => html`
              <div class="entity-stats-bar">
                <div class="stats-bar-container">
                  <div class="stats-bar-fill stats-bar-active" style="width: ${activePercent}%"></div>
                  <div class="stats-bar-fill stats-bar-archived" style="width: ${archivedPercent}%"></div>
                </div>
                <div class="stats-bar-labels">
                  <span class="stats-label-active">${entryCount} active</span>
                  ${when(archivedCount > 0, () => html`
                    <span class="stats-label-archived">${archivedCount} archived</span>
                  `)}
                </div>
              </div>
            `
    )}
        </div>
      </div>
      ${when(
      this.openMenuId === entity.id,
      () => html`
          <div class="entity-context-menu"
               id="entity-menu-${entity.id}"
               style="display: block; position: fixed; left: ${this.menuPosition.x}px; top: ${this.menuPosition.y}px;"
               @click=${(e: MouseEvent) => e.stopPropagation()}>
            <div class="context-menu-item" @click=${(e: MouseEvent) => this.handleContextMenuAction(e, 'log-entry', entity.id)}>
              <i class="ph-duotone ph-list-plus"></i>
              <span>Log</span>
            </div>
            <div class="context-menu-item" @click=${(e: MouseEvent) => this.handleContextMenuAction(e, 'edit', entity.id)}>
              <i class="ph-duotone ph-pencil-simple"></i>
              <span>Edit</span>
            </div>
            <div class="context-menu-item" @click=${(e: MouseEvent) => this.handleContextMenuAction(e, 'clone', entity.id)}>
              <i class="ph-duotone ph-copy"></i>
              <span>Clone</span>
            </div>
            <div class="context-menu-item danger" @click=${(e: MouseEvent) => this.handleContextMenuAction(e, 'delete', entity.id)}>
              <i class="ph-duotone ph-trash"></i>
              <span>Delete</span>
            </div>
          </div>
        `
    )}
    `;
  }

  render() {
    // Try to get store if not available yet
    if (!this.store) {
      try {
        this.store = storeRegistry.getStore();
        // Subscribe to store changes
        if (!this.unsubscribe) {
          this.unsubscribe = this.store.subscribe(() => this.requestUpdate());
        }
      } catch (e) {
        // Store not ready yet
        return html`
          <div class="section">
            ${this.renderLoadingState('Loading entities...')}
          </div>
        `;
      }
    }

    // Handle case where store is not loaded yet
    if (!this.store.getIsLoaded()) {
      return html`
        <div class="section">
          ${this.renderLoadingState('Loading entities...')}
        </div>
      `;
    }

    const currentSortBy = URLStateManager.getEntitySortBy() || 'entries';
    const currentSortOrder = URLStateManager.getEntitySortOrder() || 'desc';
    const entities = this.sortEntities(this.store.getEntities(), currentSortBy, currentSortOrder);

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

    if (entities.length === 0) {
      return html`
        <div class="section">
          <div class="entity-section-header-actions">
            <button class="btn btn-primary" @click=${this.handleCreateClick}>
              <i class="ph ph-plus"></i>
              Create Entity
            </button>
          </div>
          <div class="empty-state">No entities yet. Create your first entity to get started!</div>
        </div>
      `;
    }

    return html`
      <div class="section">
        <div class="entity-section-header-actions">
          <div class="tag-filter-container">
            <button class="btn-tag-filter" id="sort-filter-btn" title="Sort by">
              <i class="ph-duotone ph-sort-ascending"></i>
              <span>${currentSortLabel}</span>
            </button>
            <div class="tag-filter-menu" id="sort-filter-menu" style="display: none;">
              ${map(sortOptions, opt => html`
                <label class="tag-filter-option">
                  <input type="radio"
                         name="entity-sort-option"
                         value="${opt.value}"
                         ?checked=${opt.value === currentSortValue}
                         @change=${this.handleSortChange}>
                  <span>${escapeHtml(opt.label)}</span>
                </label>
              `)}
            </div>
          </div>
          <button class="btn-primary" @click=${this.handleCreateClick}>
            <i class="ph ph-plus"></i>
            Create Entity
          </button>
        </div>
        <div class="page-grid">
          ${map(entities, entity => this.renderEntityCard(entity))}
        </div>
      </div>
    `;
  }

  updated() {
    // Re-attach sort menu handler after render
    const filterBtn = this.querySelector('#sort-filter-btn');
    const filterMenu = this.querySelector('#sort-filter-menu') as HTMLElement;

    if (filterBtn && filterMenu) {
      filterBtn.addEventListener('click', () => {
        const isVisible = filterMenu.style.display === 'block';
        filterMenu.style.display = isVisible ? 'none' : 'block';
      });

      if (this.sortMenuCloseHandler) {
        document.removeEventListener('click', this.sortMenuCloseHandler);
      }

      this.sortMenuCloseHandler = (e: Event) => {
        if (!filterBtn.contains(e.target as Node) && !filterMenu.contains(e.target as Node)) {
          filterMenu.style.display = 'none';
        }
      };

      document.addEventListener('click', this.sortMenuCloseHandler);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entity-list': EntityListComponent;
  }
}
