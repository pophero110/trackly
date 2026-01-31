import { html, css, LitElement } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { URLStateManager } from '../utils/urlState.js';
import { Tag } from '../models/Tag.js';
import { Entry } from '../models/Entry.js';
import { Store } from '../state/Store.js';
import { storeRegistry } from '../state/StoreRegistry.js';
import { APIClient } from '../api/client.js';
import { toast } from '../utils/toast.js';
import './SelectionMenuComponent.lit.js';
import type { SelectionMenuComponent } from './SelectionMenuComponent.lit.js';
import type { SelectionOption } from './SelectionMenuComponent.lit.js';
// Phosphor icons web components
import '@phosphor-icons/webcomponents/PhSortAscending';
import '@phosphor-icons/webcomponents/PhTag';
import '@phosphor-icons/webcomponents/PhMagnifyingGlass';

type OpenSelectionMenu = 'sort' | 'tag-filter' | null;

/**
 * EntryListHeader Lit Component
 * Handles filters, sort controls, and quick entry input
 */
@customElement('entry-list-header')
export class EntryListHeader extends LitElement {
  static styles = css`
    @media (max-width: 480px) {
      :host {
        flex-direction: column-reverse;
        align-items: start !important;
      }

      .search-btn kbd {
        display: none;
      }

      .quick-entry-container {
        width: 100%;
      }

      .quick-entry-shortcut {
        display: none;
      }

      .quick-entry-input {
        padding: 12px 0 8px 8px !important;
        width: 100%;
      }
    }

    :host {
      display: flex;
      margin-top: var(--base-size-16, 16px);
      justify-content: space-between;
      align-items: center;
      max-width: 75ch;
      width: 100%;
    }

    .header-filters-row {
      display: flex;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;
    }

    .search-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 0;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      border-radius: var(--radius-sm);
      transition: var(--transition);
    }

    .search-btn:hover {
      color: var(--text-primary);
      background: var(--background);
    }

    .search-btn ph-magnifying-glass {
      font-size: 1rem;
    }

    .search-btn kbd {
      background: var(--background, #f5f5f5);
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 0.75rem;
      color: var(--text-secondary, #666);
      font-family: inherit;
    }

    .quick-entry-container {
      position: relative;
    }

    .quick-entry-input {
      font-size: 1rem;
      padding: 8px 12px;
      padding-right: 36px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background-color: var(--bg);
      color: var(--text-primary);
      outline: none !important;
    }

    .quick-entry-input:focus {
      border-color: var(--primary);
    }

    .quick-entry-input::placeholder {
      color: var(--text-secondary);
      opacity: 0.6;
    }

    .quick-entry-shortcut {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: var(--background, #f5f5f5);
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 0.75rem;
      color: var(--text-tertiary, #999);
      font-family: inherit;
      pointer-events: none;
    }

    .quick-entry-input:focus + .quick-entry-shortcut {
      display: none;
    }
  `;
  @property({ type: Object })
  selectedTag: Tag | null = null;

  @property({ type: Array })
  tagFilters: string[] = [];

  @property({ type: String })
  hashtagFilter: string | null = null;

  @property({ type: String })
  currentSortValue: string = 'timestamp-desc';

  @state()
  private availableTags: string[] = [];

  @state()
  private openSelectionMenu: OpenSelectionMenu = null;

  @query('selection-menu[data-menu-type="sort"]')
  private sortMenu?: SelectionMenuComponent;

  @query('selection-menu[data-menu-type="tag-filter"]')
  private tagFilterMenu?: SelectionMenuComponent;

  @query('.quick-entry-input')
  private quickEntryInput?: HTMLInputElement;

  private store!: Store;

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleGlobalKeydown);
    try {
      this.store = storeRegistry.getStore();
    } catch (e) {
      console.warn('EntryListHeader: Store not yet initialized');
    }
    this.loadTags();
  }

  private async loadTags(): Promise<void> {
    try {
      const response = await APIClient.getTags();
      this.availableTags = response.tags;
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleGlobalKeydown);
  }

  private handleGlobalKeydown = (e: KeyboardEvent): void => {
    // Don't trigger if user is typing in an input/textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // "Cmd+E" (Mac) or "Ctrl+E" (Windows/Linux) to focus quick entry input
    if (e.key.toLowerCase() === 'e' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      this.quickEntryInput?.focus();
    }
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
    const title = input.value.trim();
    if (!title) return;

    if (!this.store) {
      console.error('Store not available');
      return;
    }

    // Use selected tag if on tag entries page, otherwise fall back to Inbox
    const tag = this.selectedTag ?? this.store.getTags().find(t => t.name === "Inbox");
    if (!tag) return;

    try {
      const entry = new Entry({
        tagId: tag.id,
        tagName: tag.name,
        title: title,
        timestamp: new Date().toISOString(),
        notes: ''
      });

      input.value = '';
      toast.success('Quick entry created');
      await this.store.addEntry(entry);
    } catch (error) {
      console.error('Error creating quick entry:', error);
      toast.error('Failed to create entry');
    }
  };

  private handleSortMenuOpen = () => {
    // Close tag filter menu if open
    if (this.openSelectionMenu === 'tag-filter') {
      this.tagFilterMenu?.close();
    }
    this.openSelectionMenu = 'sort';
  };

  private handleTagFilterMenuOpen = () => {
    // Close sort menu if open
    if (this.openSelectionMenu === 'sort') {
      this.sortMenu?.close();
    }
    this.openSelectionMenu = 'tag-filter';
  };

  private handleSearchClick = () => {
    const searchModal = document.querySelector('search-modal') as any;
    if (searchModal?.open) {
      searchModal.open();
    }
  };

  render() {
    // Sort options
    const sortOptions: SelectionOption[] = [
      { value: 'timestamp-desc', label: 'Newest First' },
      { value: 'timestamp-asc', label: 'Oldest First' },
      { value: 'createdAt-desc', label: 'Recently Created' },
      { value: 'createdAt-asc', label: 'Oldest Created' }
    ];

    // Tag filter options (from API)
    const tagOptions: SelectionOption[] = this.availableTags.map(tag => ({
      value: tag,
      label: `#${tag}`
    }));

    // Get current tag filter (single selection)
    const currentTag = this.tagFilters.length > 0 ? this.tagFilters[0] : '';

    return html`
        <div class="header-filters-row">
          <!-- Sort Dropdown -->
          <selection-menu
            data-menu-type="sort"
            .options=${sortOptions}
            .selectedValue=${this.currentSortValue}
            .title=${'Sort by'}
            @selection-change=${this.handleSortChange}
            @menu-open=${this.handleSortMenuOpen}>
            <ph-sort-ascending slot="icon" weight="duotone"></ph-sort-ascending>
          </selection-menu>

          <!-- Tag Filter Dropdown -->
          ${when(
      tagOptions.length > 0,
      () => html`
              <selection-menu
                data-menu-type="tag-filter"
                .options=${tagOptions}
                .selectedValue=${currentTag}
                .title=${'Filter by tags'}
                .clearOptionLabel=${'All Tags'}
                @selection-change=${this.handleTagFilterChange}
                @menu-open=${this.handleTagFilterMenuOpen}>
                <ph-tag slot="icon" weight="duotone"></ph-tag>
              </selection-menu>
            `
    )}

          <!-- Search Button -->
          <button class="search-btn" @click=${this.handleSearchClick} title="Search">
            <ph-magnifying-glass weight="duotone"></ph-magnifying-glass>
            <span class="btn-label">Search</span>
            <kbd class="shortcut">⌘K</kbd>
          </button>
        </div>

        <!-- Quick Entry Input -->
        <div class="quick-entry-container">
          <input
            type="text"
            class="quick-entry-input"
            id="quick-entry-input"
            placeholder="Add a quick entry"
            autocomplete="off"
            @keypress=${this.handleQuickEntrySubmit}
          />
          <kbd class="quick-entry-shortcut">⌘E</kbd>
        </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entry-list-header': EntryListHeader;
  }
}
