import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { extractHashtags } from '../utils/helpers.js';
import { URLStateManager } from '../utils/urlState.js';
import { Entity } from '../models/Entity.js';
import { Entry } from '../models/Entry.js';
import { Store } from '../state/Store.js';
import { storeRegistry } from '../state/StoreRegistry.js';
import { toast } from '../utils/toast.js';
import './SelectionMenuComponent.lit.js';
import type { SelectionOption } from './SelectionMenuComponent.lit.js';

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

  private handleSortChange = (e: CustomEvent) => {
    const { value } = e.detail;
    const [sortBy, sortOrder] = value.split('-') as [string, 'asc' | 'desc'];
    URLStateManager.setSort(sortBy, sortOrder);
  };

  private handleTagFilterChange = (e: CustomEvent) => {
    const { value } = e.detail;
    if (value) {
      URLStateManager.setTagFilters([value]);
    } else {
      URLStateManager.setTagFilters([]);
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
    const sortOptions: SelectionOption[] = [
      { value: 'timestamp-desc', label: 'Newest First' },
      { value: 'timestamp-asc', label: 'Oldest First' },
      { value: 'createdAt-desc', label: 'Recently Created' },
      { value: 'createdAt-asc', label: 'Oldest Created' },
      { value: 'entityName-asc', label: 'Entity (A-Z)' },
      { value: 'entityName-desc', label: 'Entity (Z-A)' }
    ];

    // Extract all available tags
    const allTags = new Set<string>();
    this.allEntries.forEach(entry => {
      if (entry.notes) extractHashtags(entry.notes).forEach(tag => allTags.add(tag));
    });
    const availableTags = Array.from(allTags).sort();

    // Tag filter options
    const tagOptions: SelectionOption[] = availableTags.map(tag => ({
      value: tag,
      label: `#${tag}`
    }));

    // Get current tag filter (single selection)
    const currentTag = this.tagFilters.length > 0 ? this.tagFilters[0] : '';

    return html`
        <div class="header-filters-row">
          <!-- Sort Dropdown -->
          <selection-menu
            .options=${sortOptions}
            .selectedValue=${this.currentSortValue}
            .icon=${'ph-duotone ph-sort-ascending'}
            .title=${'Sort by'}
            @selection-change=${this.handleSortChange}>
          </selection-menu>

          <!-- Tag Filter Dropdown -->
          ${when(
      tagOptions.length > 0,
      () => html`
              <selection-menu
                .options=${tagOptions}
                .selectedValue=${currentTag}
                .icon=${'ph-duotone ph-tag'}
                .title=${'Filter by tags'}
                .clearOptionLabel=${'All Tags'}
                @selection-change=${this.handleTagFilterChange}>
              </selection-menu>
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
