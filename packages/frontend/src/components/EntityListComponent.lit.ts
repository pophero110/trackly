import { html, LitElement } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { repeat } from 'lit/directives/repeat.js';
import { StoreController } from '../controllers/StoreController.js';
import { EntityListController } from '../controllers/EntityListController.js';
import { Entity } from '../models/Entity.js';
import { escapeHtml } from '../utils/helpers.js';
import { URLStateManager } from '../utils/urlState.js';
import './DropdownMenuComponent.lit.js';
import type { DropdownMenuComponent, DropdownMenuItem } from './DropdownMenuComponent.lit.js';
import './SelectionMenuComponent.lit.js';
import type { SelectionOption } from './SelectionMenuComponent.lit.js';

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
  private currentEntityId: string | null = null;

  @query('dropdown-menu')
  private dropdownMenu?: DropdownMenuComponent;

  private documentClickHandler: ((e: Event) => void) | null = null;

  private getMenuItems(): DropdownMenuItem[] {
    return [
      {
        id: 'log-entry',
        label: 'Log',
        icon: 'ph-duotone ph-list-plus'
      },
      {
        id: 'edit',
        label: 'Edit',
        icon: 'ph-duotone ph-pencil-simple'
      },
      {
        id: 'clone',
        label: 'Clone',
        icon: 'ph-duotone ph-copy'
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: 'ph-duotone ph-trash',
        danger: true
      }
    ];
  }

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
    // No longer needed - SelectionMenuComponent handles its own click-outside
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

  private handleMenuButtonClick = (e: MouseEvent, entityId: string): void => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const menuButton = target.closest('[data-action="menu"]') as HTMLElement;

    if (!this.dropdownMenu || !menuButton) return;

    this.currentEntityId = entityId;
    const rect = menuButton.getBoundingClientRect();
    this.dropdownMenu.openAt(rect.right, rect.bottom + 4);
  };

  private handleCardContextMenu = (e: MouseEvent, entityId: string): void => {
    e.preventDefault();
    e.stopPropagation();

    if (!this.dropdownMenu) return;

    this.currentEntityId = entityId;
    this.dropdownMenu.openAt(e.clientX, e.clientY);
  };

  private handleMenuAction = (e: CustomEvent): void => {
    const { action } = e.detail;
    const entityId = this.currentEntityId;

    if (!entityId) return;

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

    this.currentEntityId = null;
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

  private handleSortChange = (e: CustomEvent): void => {
    const { value } = e.detail;
    const [sortBy, sortOrder] = value.split('-') as [string, 'asc' | 'desc'];
    URLStateManager.setEntitySort(sortBy, sortOrder);
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
          <selection-menu
            .options=${sortOptions}
            .selectedValue=${sortValue}
            .icon=${'ph-duotone ph-sort-ascending'}
            .title=${'Sort by'}
            @selection-change=${this.handleSortChange}>
          </selection-menu>
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

        <!-- Dropdown Menu -->
        <dropdown-menu
          .items=${this.getMenuItems()}
          .menuId=${'entity-menu'}
          @menu-action=${this.handleMenuAction}>
        </dropdown-menu>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entity-list': EntityListComponent;
  }
}
