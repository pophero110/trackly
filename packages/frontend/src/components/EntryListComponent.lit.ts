import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { StoreController } from '../controllers/StoreController.js';
import { EntryListController } from '../controllers/EntryListController.js';
import { URLStateManager } from '../utils/urlState.js';
import './EntryListHeader.lit.js';
import './EntryListItem.lit.js';

/**
 * EntryList Lit Component for displaying entries in a timeline view
 * Uses Reactive Controllers for separation of concerns:
 * - StoreController: Manages store connection and updates
 * - EntryListController: Handles filtering, grouping, and business logic
 */
@customElement('entry-list')
export class EntryListComponent extends LitElement {
  // Controllers handle all logic
  // Use selector to avoid re-renders when unrelated store data changes
  private storeController = new StoreController(this, {
    selector: (store) => ({
      isLoaded: store.getIsLoaded(),
      selectedEntityId: store.getSelectedEntityId(),
      // Track entry version to detect any entry mutations
      entryVersion: store.getEntryVersion(),
    })
  });
  private listController = new EntryListController(this, this.storeController);
  private unsubscribeUrl: (() => void) | null = null;
  private observer: IntersectionObserver | null = null;
  private sentinelRef: Element | null = null;

  // Disable Shadow DOM for compatibility with existing global styles
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    // Subscribe to URL changes for tag filter updates
    this.unsubscribeUrl = URLStateManager.subscribe(() => {
      this.requestUpdate();
    });

    // Setup IntersectionObserver after first render
    this.updateComplete.then(() => this.setupIntersectionObserver());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.unsubscribeUrl) {
      this.unsubscribeUrl();
      this.unsubscribeUrl = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.sentinelRef = null;
  }

  private setupIntersectionObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        const sentinel = entries[0];
        if (sentinel.isIntersecting) {
          this.listController.loadMoreEntries();
        }
      },
      {
        root: null,
        rootMargin: '200px',
        threshold: 0
      }
    );
  }

  updated() {
    // Re-observe sentinel after render
    const sentinel = this.querySelector('.load-more-sentinel');
    if (sentinel && this.observer) {
      if (this.sentinelRef !== sentinel) {
        if (this.sentinelRef) {
          this.observer.unobserve(this.sentinelRef);
        }
        this.observer.observe(sentinel);
        this.sentinelRef = sentinel;
      }
    }
  }

  render() {
    // Check if store is available and loaded
    if (!this.storeController.store || !this.storeController.isLoaded) {
      return html`
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading entries...</p>
          </div>
      `;
    }

    // Get all data from controllers
    const entries = this.listController.getFilteredEntries();
    const selectedEntity = this.listController.getSelectedEntity();
    const tagFilters = this.listController.getTagFilters();
    const { sortValue } = this.listController.getSortConfig();
    const allEntries = this.listController.getAllEntries();

    // Empty state
    if (entries.length === 0) {
      const msg = selectedEntity ? `No entries yet for ${selectedEntity.name}.` : 'No entries yet.';
      return html`
          <entry-list-header
            .selectedEntity=${selectedEntity}
            .tagFilters=${tagFilters}
            .currentSortValue=${sortValue}
            .allEntries=${allEntries}>
          </entry-list-header>
          <div class="empty-state">${msg}</div>
      `;
    }

    // Group entries by date using controller
    const entriesByDate = this.listController.groupEntriesByDate(entries);
    const { hasMore, isLoadingMore } = this.listController.getPaginationState();

    return html`
        <entry-list-header
          .selectedEntity=${selectedEntity}
          .tagFilters=${tagFilters}
          .currentSortValue=${sortValue}
          .allEntries=${allEntries}>
        </entry-list-header>
          ${repeat(
      Array.from(entriesByDate.entries()),
      ([dateKey]) => dateKey,
      ([dateKey, dateEntries]) => html`
              <div class="timeline-date-group">
                <div class="timeline-date-header">${dateKey}</div>
                <div class="timeline-entries">
                  ${repeat(
        dateEntries,
        (entry) => entry.id,
        (entry) => html`
                      <entry-list-item .entry=${entry}></entry-list-item>
                    `
      )}
                </div>
              </div>
            `
    )}
        ${hasMore ? html`
          <div class="load-more-sentinel">
            ${isLoadingMore ? html`
              <div class="loading-more">
                <div class="spinner-small"></div>
                <span>Loading more...</span>
              </div>
            ` : ''}
          </div>
        ` : entries.length > 0 ? html`
          <div class="end-of-list">No more entries</div>
        ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entry-list': EntryListComponent;
  }
}
