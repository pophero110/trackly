import { html, LitElement } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { StoreController } from '../controllers/StoreController.js';
import { TagListController } from '../controllers/TagListController.js';
import { Tag } from '../models/Tag.js';
import { URLStateManager } from '../utils/urlState.js';
import './DropdownMenuComponent.lit.js';
import type { DropdownMenuComponent, DropdownMenuItem } from './DropdownMenuComponent.lit.js';
import './SelectionMenuComponent.lit.js';
// Phosphor icons web components
import '@phosphor-icons/webcomponents/PhSortAscending';

/**
 * TagList Lit Component for displaying tags in a grid layout
 * Uses Reactive Controllers for separation of concerns:
 * - StoreController: Manages store connection and updates
 * - TagListController: Handles sorting and business logic
 */
@customElement('tag-list')
export class TagListComponent extends LitElement {
  // Controllers handle store and business logic
  private storeController = new StoreController(this);
  private listController = new TagListController(this, this.storeController);

  @state()
  private currentTagId: string | null = null;

  @query('dropdown-menu')
  private dropdownMenu?: DropdownMenuComponent;

  private documentClickHandler: ((e: Event) => void) | null = null;

  private getMenuItems(): DropdownMenuItem[] {
    return [
      {
        id: 'edit',
        label: 'Edit',
        icon: 'ph-duotone ph-pencil-simple'
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
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeDocumentListeners();
  }

  private removeDocumentListeners(): void {
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
      this.documentClickHandler = null;
    }
  }

  private handleCreateClick = (): void => {
    URLStateManager.openCreateTagPanel();
  };

  private handleCardClick = (e: MouseEvent, tagId: string): void => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-action="menu"]')) {
      return;
    }

    const tag = this.storeController.store?.getTagById(tagId);
    if (tag) {
      URLStateManager.showEntryList(tag.name);
    }
  };

  private handleMenuButtonClick = (e: MouseEvent, tagId: string): void => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const menuButton = target.closest('[data-action="menu"]') as HTMLElement;

    if (!this.dropdownMenu || !menuButton) return;

    this.currentTagId = tagId;
    const rect = menuButton.getBoundingClientRect();
    this.dropdownMenu.openAt(rect.right, rect.bottom + 4);
  };

  private handleCardContextMenu = (e: MouseEvent, tagId: string): void => {
    e.preventDefault();
    e.stopPropagation();

    if (!this.dropdownMenu) return;

    this.currentTagId = tagId;
    this.dropdownMenu.openAt(e.clientX, e.clientY);
  };

  private handleMenuAction = (e: CustomEvent): void => {
    const { action } = e.detail;
    const tagId = this.currentTagId;

    if (!tagId) return;

    switch (action) {
      case 'delete':
        this.handleDelete(tagId);
        break;
      case 'edit':
        this.handleEdit(tagId);
        break;
    }

    this.currentTagId = null;
  };

  private handleDelete(tagId: string): void {
    const tag = this.storeController.store?.getTagById(tagId);
    if (!tag) return;

    if (!confirm(`Are you sure you want to delete "${tag.name}"? All related entries will also be deleted.`)) {
      return;
    }

    try {
      this.storeController.store?.deleteTag(tagId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error deleting tag: ${message}`);
    }
  }

  private handleEdit(tagId: string): void {
    const tag = this.storeController.store?.getTagById(tagId);
    if (!tag) return;
    URLStateManager.openEditTagPanel(tag.name);
  }

  private handleSortChange = (e: CustomEvent): void => {
    const { value } = e.detail;
    const [sortBy, sortOrder] = value.split('-') as [string, 'asc' | 'desc'];
    URLStateManager.setTagSort(sortBy, sortOrder);
  };

  private renderTagCard(tag: Tag) {
    const isSelected = this.listController.isTagSelected(tag.id);

    return html`
      <div class="tag-card ${isSelected ? 'selected' : ''}"
           role="button"
           tabindex="0"
           data-tag-id="${tag.id}"
           @click=${(e: MouseEvent) => this.handleCardClick(e, tag.id)}
           @contextmenu=${(e: MouseEvent) => this.handleCardContextMenu(e, tag.id)}>
        <div class="tag-card-header">
          <div class="tag-name-type">
            <h3>${tag.name}</h3>
            <span class="tag-type ${tag.type.toLowerCase()}">${tag.type}</span>
          </div>
          <button class="tag-menu-btn"
                  data-tag-id="${tag.id}"
                  data-action="menu"
                  @click=${(e: MouseEvent) => this.handleMenuButtonClick(e, tag.id)}>⋮</button>
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
            <p>Loading tags...</p>
          </div>
      `;
    }

    // Get sorted tags from controller
    const tags = this.listController.getSortedTags();
    const { sortValue } = this.listController.getSortConfig();

    const sortOptions = [
      { value: 'created-desc', label: 'Newest First' },
      { value: 'created-asc', label: 'Oldest First' },
      { value: 'name-asc', label: 'Name (A-Z)' },
      { value: 'name-desc', label: 'Name (Z-A)' }
    ];

    if (tags.length === 0) {
      return html`
          <div class="tag-section-header-actions">
            <button class="btn btn-primary" @click=${this.handleCreateClick}>
              <i class="ph ph-plus"></i>
              Create Tag
            </button>
          </div>
          <div class="empty-state">No tags yet. Create your first tag to get started!</div>
      `;
    }

    return html`
        <div class="tag-section-header-actions">
          <selection-menu
            .options=${sortOptions}
            .selectedValue=${sortValue}
            .title=${'Sort by'}
            @selection-change=${this.handleSortChange}>
            <ph-sort-ascending slot="icon" weight="duotone"></ph-sort-ascending>
          </selection-menu>
          <button class="btn-primary" @click=${this.handleCreateClick}>
            <i class="ph ph-plus"></i>
            Create Tag
          </button>
        </div>
        <div class="tag-grid">
          ${repeat(
      tags,
      (tag) => tag.id,
      (tag) => this.renderTagCard(tag)
    )}
        </div>

        <!-- Dropdown Menu -->
        <dropdown-menu
          .items=${this.getMenuItems()}
          .menuId=${'tag-menu'}
          @menu-action=${this.handleMenuAction}>
        </dropdown-menu>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tag-list': TagListComponent;
  }
}
