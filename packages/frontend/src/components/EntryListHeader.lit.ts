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

    // Single selection - set only this tag as the filter
    URLStateManager.setTagFilters([tag]);
    this.tagMenuOpen = false;
  };

  private handleClearTagFilter = () => {
    URLStateManager.setTagFilters([]);
    this.tagMenuOpen = false;
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

    // Get current tag filter (single selection)
    const currentTag = this.tagFilters.length > 0 ? this.tagFilters[0] : null;
    const currentTagLabel = currentTag ? `#${currentTag}` : 'All Tags';

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
                  class="btn-tag-filter"
                  id="tag-filter-btn"
                  title="Filter by tags"
                  @click=${(e: Event) => { e.stopPropagation(); this.tagMenuOpen = !this.tagMenuOpen; }}>
                  <i class="ph-duotone ph-tag"></i>
                  <span>${currentTagLabel}</span>
                </button>
                <div
                  class="tag-filter-menu"
                  id="tag-filter-menu"
                  style="display: ${this.tagMenuOpen ? 'block' : 'none'};">
                  <!-- "All Tags" option to clear filter -->
                  <label class="tag-filter-option">
                    <input
                      type="radio"
                      name="tag-filter-option"
                      value=""
                      ?checked=${!currentTag}
                      @change=${this.handleClearTagFilter}>
                    <span>All Tags</span>
                  </label>
                  ${map(availableTags, tag => html`
                    <label class="tag-filter-option">
                      <input
                        type="radio"
                        name="tag-filter-option"
                        value="${escapeHtml(tag)}"
                        ?checked=${currentTag === tag}
                        @change=${this.handleTagFilterChange}>
                      <span>#${escapeHtml(tag)}</span>
                    </label>
                  `)}
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
