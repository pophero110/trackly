import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { escapeHtml, extractHashtags } from '../utils/helpers.js';
import { URLStateManager } from '../utils/urlState.js';
import { Entity } from '../models/Entity.js';
import { Entry } from '../models/Entry.js';
import { Store } from '../state/Store.js';
import { storeRegistry } from '../state/StoreRegistry.js';
import { toast } from '../utils/toast.js';

/**
 * EntryListHeader Lit Component
 * Handles filters, sort controls, and quick entry input
 */
@customElement('entry-list-header')
export class EntryListHeader extends LitElement {
  @property({ type: Object })
  selectedEntity: Entity | null = null;

  @property({ type: Array })
  tagFilters: string[] = [];

  @property({ type: String })
  hashtagFilter: string | null = null;

  @property({ type: String })
  currentSortValue: string = 'timestamp-desc';

  @property({ type: Array })
  allEntries: Entry[] = [];

  @state()
  private sortMenuOpen: boolean = false;

  @state()
  private tagMenuOpen: boolean = false;

  @state()
  private entityMenuOpen: boolean = false;

  private store!: Store;

  connectedCallback(): void {
    super.connectedCallback();
    try {
      this.store = storeRegistry.getStore();
    } catch (e) {
      console.warn('EntryListHeader: Store not yet initialized');
    }
  }

  // Disable Shadow DOM for compatibility with existing global styles
  createRenderRoot() {
    return this;
  }

  private handleClearHashtag = () => {
    URLStateManager.setHashtagFilter(null);
  };

  private handleSortChange = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    const [sortBy, sortOrder] = value.split('-') as [string, 'asc' | 'desc'];
    URLStateManager.setSort(sortBy, sortOrder);
    this.sortMenuOpen = false;
  };

  private handleTagFilterChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const tag = target.value;

    if (target.checked) {
      URLStateManager.addTagFilter(tag);
    } else {
      URLStateManager.removeTagFilter(tag);
    }
  };

  private handleQuickEntrySubmit = async (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;

    const input = e.target as HTMLInputElement;
    const notes = input.value.trim();
    if (!notes) return;

    if (!this.store) {
      console.error('Store not available');
      return;
    }

    const entity = this.store.getEntities().filter(e => e.name === "Inbox")[0];
    if (!entity) return;

    try {
      const entry = new Entry({
        entityId: entity.id,
        entityName: entity.name,
        timestamp: new Date().toISOString(),
        notes: `# ${notes}`
      });

      input.value = '';
      toast.success('Quick entry created');
      await this.store.addEntry(entry);
    } catch (error) {
      console.error('Error creating quick entry:', error);
      toast.error('Failed to create entry');
    }
  };

  private handleEntityMenuAction = (e: MouseEvent, action: string) => {
    e.stopPropagation();
    if (!this.selectedEntity) return;

    const entityId = this.selectedEntity.id;
    this.entityMenuOpen = false;

    if (action === 'delete') {
      this.handleEntityDelete(entityId);
    } else if (action === 'edit') {
      URLStateManager.openEditEntityPanel(this.selectedEntity.name);
    } else if (action === 'clone') {
      URLStateManager.openCloneEntityPanel(this.selectedEntity.name);
    }
  };

  private handleEntityDelete(entityId: string): void {
    if (!this.store) return;

    const entity = this.store.getEntityById(entityId);
    if (!entity) return;

    if (!confirm(`Are you sure you want to delete "${entity.name}"? All entries associated with this entity will also be deleted.`)) {
      return;
    }

    try {
      this.store.deleteEntity(entityId);
      URLStateManager.showHome();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error deleting entity: ${message}`);
    }
  }

  private handleDocumentClick = (e: Event) => {
    const target = e.target as HTMLElement;

    // Close sort menu if clicked outside
    if (!target.closest('#sort-filter-btn') && !target.closest('#sort-filter-menu')) {
      this.sortMenuOpen = false;
    }

    // Close tag menu if clicked outside
    if (!target.closest('#tag-filter-btn') && !target.closest('#tag-filter-menu')) {
      this.tagMenuOpen = false;
    }

    // Close entity menu if clicked outside
    if (!target.closest('#entity-page-menu-btn') && !target.closest('#entity-page-menu')) {
      this.entityMenuOpen = false;
    }
  };

  firstUpdated() {
    document.addEventListener('click', this.handleDocumentClick);
  }

  updated() {
    // Adjust entity menu position if open
    if (this.entityMenuOpen && this.selectedEntity) {
      const menu = this.querySelector('#entity-page-menu') as HTMLElement;
      const menuButton = this.querySelector('#entity-page-menu-btn') as HTMLElement;

      if (menu && menuButton) {
        const rect = menuButton.getBoundingClientRect();
        const menuWidth = menu.offsetWidth;

        menu.style.position = 'fixed';
        menu.style.left = `${rect.right - menuWidth}px`;
        menu.style.top = `${rect.bottom + 4}px`;
      }
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this.handleDocumentClick);
  }

  render() {
    // Sort options
    const sortOptions = [
      { value: 'timestamp-desc', label: 'Newest First' },
      { value: 'timestamp-asc', label: 'Oldest First' },
      { value: 'createdAt-desc', label: 'Recently Created' },
      { value: 'createdAt-asc', label: 'Oldest Created' },
      { value: 'entityName-asc', label: 'Entity (A-Z)' },
      { value: 'entityName-desc', label: 'Entity (Z-A)' }
    ];
    const currentSortLabel = sortOptions.find(opt => opt.value === this.currentSortValue)?.label || 'Newest First';

    // Extract all available tags
    const allTags = new Set<string>();
    this.allEntries.forEach(entry => {
      if (entry.notes) extractHashtags(entry.notes).forEach(tag => allTags.add(tag));
    });
    const availableTags = Array.from(allTags).sort();

    const selectedTagChips = this.tagFilters.map(tag =>
      html`<span class="tag-chip-inline">#${tag}</span>`
    );

    return html`
        <div class="header-filters-row">
          <!-- Sort Dropdown -->
          <div class="tag-filter-container">
            <button
              class="btn-tag-filter"
              id="sort-filter-btn"
              title="Sort by"
              @click=${(e: Event) => { e.stopPropagation(); this.sortMenuOpen = !this.sortMenuOpen; }}>
              <i class="ph-duotone ph-sort-ascending"></i>
              <span>${currentSortLabel}</span>
            </button>
            <div
              class="tag-filter-menu"
              id="sort-filter-menu"
              style="display: ${this.sortMenuOpen ? 'block' : 'none'};">
              ${map(sortOptions, opt => html`
                <label class="tag-filter-option">
                  <input
                    type="radio"
                    name="sort-option"
                    value="${opt.value}"
                    ?checked=${opt.value === this.currentSortValue}
                    @change=${this.handleSortChange}>
                  <span>${escapeHtml(opt.label)}</span>
                </label>
              `)}
            </div>
          </div>

          <!-- Tag Filter Dropdown -->
          ${when(
      availableTags.length > 0,
      () => html`
              <div class="tag-filter-container">
                <button
                  class="btn-tag-filter ${this.tagFilters.length > 0 ? 'has-filters' : ''}"
                  id="tag-filter-btn"
                  title="Filter by tags"
                  @click=${(e: Event) => { e.stopPropagation(); this.tagMenuOpen = !this.tagMenuOpen; }}>
                  <i class="ph-duotone ph-tag"></i>
                  ${selectedTagChips}
                </button>
                <div
                  class="tag-filter-menu"
                  id="tag-filter-menu"
                  style="display: ${this.tagMenuOpen ? 'block' : 'none'};">
                  ${map(availableTags, tag => html`
                    <label class="tag-filter-option">
                      <input
                        type="checkbox"
                        value="${escapeHtml(tag)}"
                        ?checked=${this.tagFilters.includes(tag)}
                        @change=${this.handleTagFilterChange}>
                      <span>#${escapeHtml(tag)}</span>
                    </label>
                  `)}
                </div>
              </div>
            `
    )}

          <!-- Hashtag Filter Badge -->
          ${when(
      this.hashtagFilter,
      () => html`
              <span class="hashtag-filter-badge">
                #${this.hashtagFilter}
                <button class="clear-hashtag" @click=${this.handleClearHashtag}>×</button>
              </span>
            `
    )}

          <!-- Entity Page Menu -->
          ${when(
      this.selectedEntity,
      () => html`
              <button
                class="entry-menu-btn"
                id="entity-page-menu-btn"
                data-entity-id="${this.selectedEntity!.id}"
                @click=${(e: Event) => { e.stopPropagation(); this.entityMenuOpen = !this.entityMenuOpen; }}>
                ⋮
              </button>
              <div
                class="entity-context-menu"
                id="entity-page-menu"
                style="display: ${this.entityMenuOpen ? 'block' : 'none'};">
                <div class="context-menu-item" @click=${(e: MouseEvent) => this.handleEntityMenuAction(e, 'edit')}>
                  <i class="ph-duotone ph-pencil-simple"></i>Edit
                </div>
                <div class="context-menu-item" @click=${(e: MouseEvent) => this.handleEntityMenuAction(e, 'clone')}>
                  <i class="ph-duotone ph-copy"></i>Clone
                </div>
                <div class="context-menu-item danger" @click=${(e: MouseEvent) => this.handleEntityMenuAction(e, 'delete')}>
                  <i class="ph-duotone ph-trash"></i>Delete
                </div>
              </div>
            `
    )}
        </div>

        <!-- Quick Entry Input -->
        <input
          type="text"
          class="quick-entry-input"
          id="quick-entry-input"
          placeholder="Add a quick note..."
          autocomplete="off"
          @keypress=${this.handleQuickEntrySubmit}
        />
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entry-list-header': EntryListHeader;
  }
}
