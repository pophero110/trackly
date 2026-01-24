import { html, LitElement } from 'lit';
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

  createRenderRoot() {
    return this;
  }

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
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleGlobalKeydown);
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
    this.isOpen = true;
    this.searchQuery = '';
    this.results = [];
    this.selectedIndex = 0;
    document.body.style.overflow = 'hidden';

    // Focus input after render
    this.updateComplete.then(() => {
      this.searchInput?.focus();
    });
  }

  close(): void {
    this.isOpen = false;
    this.searchQuery = '';
    this.results = [];
    document.body.style.overflow = '';
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
                        <span class="search-result-entity">${escapeHtml(entity?.name || '')}</span>
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
              No entries found for "${escapeHtml(this.searchQuery)}"
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
