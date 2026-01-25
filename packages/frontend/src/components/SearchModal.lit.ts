import { html, css, LitElement } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { Entry } from '../models/Entry.js';
import { storeRegistry } from '../state/StoreRegistry.js';
import { Store } from '../state/Store.js';
import { URLStateManager } from '../utils/urlState.js';
import { escapeHtml } from '../utils/helpers.js';

/**
 * SearchModal component for global search (Cmd+K)
 * Searches entries by title and notes
 */
@customElement('search-modal')
export class SearchModal extends LitElement {
  static styles = css`
    .search-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 15vh;
      z-index: 1000;
    }

    .search-modal-container {
      background: var(--surface, #fff);
      border-radius: 12px;
      width: 100%;
      max-width: 600px;
      box-shadow: 0 16px 70px rgba(0, 0, 0, 0.2);
      overflow: hidden;
    }

    .search-modal-input-wrapper {
      display: flex;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid var(--border, #e0e0e0);
    }

    .search-modal-icon {
      font-size: 1.25rem;
      color: var(--text-secondary, #666);
    }

    .search-input {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 1.125rem;
      color: var(--text-primary, #333);
      outline: none;
    }

    .search-input::placeholder {
      color: var(--text-tertiary, #999);
    }

    .search-modal-kbd {
      background: var(--background, #f5f5f5);
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 0.75rem;
      color: var(--text-secondary, #666);
      font-family: inherit;
    }

    .search-modal-results {
      max-height: 400px;
      overflow-y: auto;
    }

    .search-result-item {
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid var(--border, #e0e0e0);
    }

    .search-result-item:last-child {
      border-bottom: none;
    }

    .search-result-item:hover,
    .search-result-item.selected {
      background: var(--background, #f5f5f5);
    }

    .search-result-title {
      font-weight: 500;
      color: var(--text-primary, #333);
      margin-bottom: 4px;
    }

    .search-result-title mark {
      background: var(--accent-subtle, #e3f2fd);
      color: var(--accent, #1976d2);
      padding: 0 2px;
      border-radius: 2px;
    }

    .search-result-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.875rem;
      color: var(--text-secondary, #666);
    }

    .search-result-entity {
      background: var(--accent-subtle, #e3f2fd);
      color: var(--accent, #1976d2);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
    }

    .search-result-preview {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }

    .search-result-preview mark {
      background: var(--accent-subtle, #e3f2fd);
      color: var(--accent, #1976d2);
      padding: 0 2px;
      border-radius: 2px;
    }

    .search-modal-empty,
    .search-modal-hint {
      padding: 24px;
      text-align: center;
      color: var(--text-secondary, #666);
    }
  `;

  @state()
  private isOpen: boolean = false;

  @state()
  private searchQuery: string = '';

  @state()
  private results: Entry[] = [];

  @state()
  private selectedIndex: number = 0;

  @query('.search-input')
  private searchInput?: HTMLInputElement;

  private store: Store | null = null;

  private unsubscribeUrl: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleGlobalKeydown);

    try {
      this.store = storeRegistry.getStore();
    } catch {
      storeRegistry.onStoreInitialized(() => {
        this.store = storeRegistry.getStore();
      });
    }

    // Subscribe to URL changes
    this.unsubscribeUrl = URLStateManager.subscribe(() => {
      this.syncWithUrl();
    });

    // Check if we should open based on current URL
    this.syncWithUrl();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleGlobalKeydown);
    if (this.unsubscribeUrl) {
      this.unsubscribeUrl();
      this.unsubscribeUrl = null;
    }
  }

  private syncWithUrl(): void {
    const shouldBeOpen = URLStateManager.isSearchOpen();

    if (shouldBeOpen && !this.isOpen) {
      this.isOpen = true;
      this.searchQuery = '';
      this.results = [];
      this.selectedIndex = 0;
      document.body.style.overflow = 'hidden';
      this.updateComplete.then(() => {
        this.searchInput?.focus();
      });
    } else if (!shouldBeOpen && this.isOpen) {
      this.isOpen = false;
      this.searchQuery = '';
      this.results = [];
      document.body.style.overflow = '';
    }
  }

  private handleGlobalKeydown = (e: KeyboardEvent): void => {
    // Cmd+K or Ctrl+K to open
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      this.open();
    }

    // Escape to close
    if (e.key === 'Escape' && this.isOpen) {
      e.preventDefault();
      this.close();
    }
  };

  private handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.results.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
    } else if (e.key === 'Enter' && this.results.length > 0) {
      e.preventDefault();
      this.selectResult(this.results[this.selectedIndex]);
    }
  };

  private handleInput = (e: InputEvent): void => {
    const input = e.target as HTMLInputElement;
    this.searchQuery = input.value;
    this.search();
  };

  private search(): void {
    if (!this.store || !this.searchQuery.trim()) {
      this.results = [];
      this.selectedIndex = 0;
      return;
    }

    const query = this.searchQuery.toLowerCase().trim();
    const allEntries = this.store.getEntries();

    this.results = allEntries
      .filter(entry => {
        const titleMatch = entry.title?.toLowerCase().includes(query);
        const notesMatch = entry.notes?.toLowerCase().includes(query);
        return titleMatch || notesMatch;
      })
      .slice(0, 10); // Limit to 10 results

    this.selectedIndex = 0;
  }

  private selectResult(entry: Entry): void {
    this.close();
    URLStateManager.showEntryDetail(entry.id);
  }

  private handleBackdropClick = (e: MouseEvent): void => {
    if ((e.target as HTMLElement).classList.contains('search-modal-backdrop')) {
      this.close();
    }
  };

  open(): void {
    if (this.isOpen) return;
    URLStateManager.openSearch();
  }

  close(): void {
    if (!this.isOpen) return;
    URLStateManager.closeSearch();
  }

  private highlightMatch(text: string, query: string): string {
    if (!query.trim() || !text) return escapeHtml(text || '');

    const escaped = escapeHtml(text);
    const queryEscaped = escapeHtml(query);
    const regex = new RegExp(`(${queryEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }

  render() {
    if (!this.isOpen) {
      return html``;
    }

    return html`
      <div class="search-modal-backdrop" @click=${this.handleBackdropClick}>
        <div class="search-modal-container">
          <div class="search-modal-input-wrapper">
            <i class="ph-duotone ph-magnifying-glass search-modal-icon"></i>
            <input
              type="text"
              class="search-input"
              placeholder="Search entries..."
              .value=${this.searchQuery}
              @input=${this.handleInput}
              @keydown=${this.handleKeydown}
            >
            <kbd class="search-modal-kbd">ESC</kbd>
          </div>

          ${this.results.length > 0 ? html`
            <div class="search-modal-results">
              ${repeat(
      this.results,
      (entry) => entry.id,
      (entry, index) => {
        const entity = this.store?.getEntityById(entry.entityId);
        return html`
                    <div
                      class="search-result-item ${index === this.selectedIndex ? 'selected' : ''}"
                      @click=${() => this.selectResult(entry)}
                      @mouseenter=${() => { this.selectedIndex = index; }}
                    >
                      <div class="search-result-title">
                        ${unsafeHTML(this.highlightMatch(entry.title || 'Untitled', this.searchQuery))}
                      </div>
                      <div class="search-result-meta">
                        <span class="search-result-entity">${entity?.name || ''}</span>
                        ${entry.notes ? html`
                          <span class="search-result-preview">
                            ${unsafeHTML(this.highlightMatch(entry.notes.substring(0, 100), this.searchQuery))}
                          </span>
                        ` : ''}
                      </div>
                    </div>
                  `;
      }
    )}
            </div>
          ` : this.searchQuery.trim() ? html`
            <div class="search-modal-empty">
              No entries found for "${this.searchQuery}"
            </div>
          ` : html`
            <div class="search-modal-hint">
              Type to search entries by title or notes
            </div>
          `}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'search-modal': SearchModal;
  }
}
