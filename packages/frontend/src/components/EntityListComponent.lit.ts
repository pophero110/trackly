import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { repeat } from 'lit/directives/repeat.js';
import { StoreController } from '../controllers/StoreController.js';
import { EntityListController } from '../controllers/EntityListController.js';
import { Entity } from '../models/Entity.js';
import { escapeHtml } from '../utils/helpers.js';
import { URLStateManager } from '../utils/urlState.js';

/**
 * EntityList Lit Component for displaying entities in a grid layout
 * Uses Reactive Controllers for separation of concerns:
 * - StoreController: Manages store connection and updates
 * - EntityListController: Handles sorting and business logic
 */
@customElement('entity-list')
export class EntityListComponent extends LitElement {
  // Controllers handle store and business logic
  private storeController = new StoreController(this);
  private listController = new EntityListController(this, this.storeController);

  @state()
  private openMenuId: string | null = null;

  @state()
  private menuPosition: { x: number; y: number } = { x: 0, y: 0 };

  @state()
  private sortMenuOpen: boolean = false;

  private documentClickHandler: ((e: Event) => void) | null = null;

  // Disable Shadow DOM for compatibility with existing global styles
  createRenderRoot() {
    return this;
  }

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
      if (!target.closest('#sort-filter-btn') && !target.closest('#sort-filter-menu')) {
        this.sortMenuOpen = false;
      }
    };
    document.addEventListener('click', this.documentClickHandler);
  }

  private removeDocumentListeners(): void {
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
      this.documentClickHandler = null;
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

    const entity = this.storeController.store?.getEntityById(entityId);
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
    const entity = this.storeController.store?.getEntityById(entityId);
    if (!entity) return;

    if (!confirm(`Are you sure you want to delete "${entity.name}"? All related entries will also be deleted.`)) {
      return;
    }

    try {
      this.storeController.store?.deleteEntity(entityId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error deleting entity: ${message}`);
    }
  }

  private handleEdit(entityId: string): void {
    const entity = this.storeController.store?.getEntityById(entityId);
    if (!entity) return;
    URLStateManager.openEditEntityPanel(entity.name);
  }

  private handleClone(entityId: string): void {
    const entity = this.storeController.store?.getEntityById(entityId);
    if (!entity) return;
    URLStateManager.openCloneEntityPanel(entity.name);
  }

  private handleLogEntry(entityId: string): void {
    const entity = this.storeController.store?.getEntityById(entityId);
    if (!entity) return;
    URLStateManager.openLogEntryPanel(entity.name);
  }

  private handleSortChange = (e: Event): void => {
    const value = (e.target as HTMLInputElement).value;
    const [sortBy, sortOrder] = value.split('-') as [string, 'asc' | 'desc'];
    URLStateManager.setEntitySort(sortBy, sortOrder);
    this.sortMenuOpen = false;
  };

  private renderEntityCard(entity: Entity) {
    const { active, archived, total } = this.listController.getEntityEntryCount(entity.id);
    const isSelected = this.listController.isEntitySelected(entity.id);

    const activePercent = total > 0 ? (active / total) * 100 : 0;
    const archivedPercent = total > 0 ? (archived / total) * 100 : 0;

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
      total > 0,
      () => html`
              <div class="entity-stats-bar">
                <div class="stats-bar-container">
                  <div class="stats-bar-fill stats-bar-active" style="width: ${activePercent}%"></div>
                  <div class="stats-bar-fill stats-bar-archived" style="width: ${archivedPercent}%"></div>
                </div>
                <div class="stats-bar-labels">
                  <span class="stats-label-active">${active} active</span>
                  ${when(archived > 0, () => html`
                    <span class="stats-label-archived">${archived} archived</span>
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
    // Check if store is available and loaded
    if (!this.storeController.store || !this.storeController.isLoaded) {
      return html`
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading entities...</p>
          </div>
      `;
    }

    // Get sorted entities from controller
    const entities = this.listController.getSortedEntities();
    const { sortValue } = this.listController.getSortConfig();

    const sortOptions = [
      { value: 'created-desc', label: 'Newest First' },
      { value: 'created-asc', label: 'Oldest First' },
      { value: 'name-asc', label: 'Name (A-Z)' },
      { value: 'name-desc', label: 'Name (Z-A)' },
      { value: 'entries-desc', label: 'Most Entries' },
      { value: 'entries-asc', label: 'Least Entries' },
      { value: 'type-asc', label: 'Type' }
    ];

    const currentSortLabel = sortOptions.find(opt => opt.value === sortValue)?.label || 'Most Entries';

    if (entities.length === 0) {
      return html`
          <div class="entity-section-header-actions">
            <button class="btn btn-primary" @click=${this.handleCreateClick}>
              <i class="ph ph-plus"></i>
              Create Entity
            </button>
          </div>
          <div class="empty-state">No entities yet. Create your first entity to get started!</div>
      `;
    }

    return html`
        <div class="entity-section-header-actions">
          <div class="tag-filter-container">
            <button class="btn-tag-filter" id="sort-filter-btn" title="Sort by"
                    @click=${(e: Event) => { e.stopPropagation(); this.sortMenuOpen = !this.sortMenuOpen; }}>
              <i class="ph-duotone ph-sort-ascending"></i>
              <span>${currentSortLabel}</span>
            </button>
            <div class="tag-filter-menu" id="sort-filter-menu" style="display: ${this.sortMenuOpen ? 'block' : 'none'};">
              ${map(sortOptions, opt => html`
                <label class="tag-filter-option">
                  <input type="radio"
                         name="entity-sort-option"
                         value="${opt.value}"
                         ?checked=${opt.value === sortValue}
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
        <div class="entity-grid">
          ${repeat(
      entities,
      (entity) => entity.id,
      (entity) => this.renderEntityCard(entity)
    )}
        </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entity-list': EntityListComponent;
  }
}
