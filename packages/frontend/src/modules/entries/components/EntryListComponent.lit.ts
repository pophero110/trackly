import { html, LitElement, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { StoreController } from '../../../core/controllers/StoreController.js';
import { EntryListController } from '../controllers/EntryListController.js';
import { URLStateManager } from '../../../core/utils/urlState.js';
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
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      padding: 0 var(--base-size-8);
      margin-top: var(--base-size-8);
      gap: var(--base-size-16);
      align-items: center;
      justify-content: center;
      width: 100%;
    }

    /* Timeline styles */
    .timeline-entries {
      display: grid;
      grid-template-columns: minmax(0, 75ch);
      gap: var(--base-size-16, 16px);
    }

    /* Loading and empty states */
    .loading-state,
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-muted);
      font-size: 0.875rem;
      background: transparent;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--base-size-16, 16px);
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .spinner-small {
      width: 16px;
      height: 16px;
      border: 2px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .load-more-sentinel {
      min-height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .loading-more {
      display: flex;
      align-items: center;
      gap: var(--base-size-8, 8px);
      color: var(--text-muted);
      font-size: 0.875rem;
      padding: var(--base-size-16, 16px);
    }

    .end-of-list {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.875rem;
      padding: var(--base-size-24, 24px) var(--base-size-16, 16px);
    }

    /* Responsive styles */
    @media (max-width: 480px) {
      :host {
        padding: 0 16px !important;
        gap: 0;
      }
    }
  `;

  // Controllers handle all logic
  // Use selector to avoid re-renders when unrelated store data changes
  private storeController = new StoreController(this, {
    selector: (store) => ({
      isLoaded: store.getIsLoaded(),
      selectedTagId: store.getSelectedTagId(),
      // Track entry version to detect any entry mutations
      entryVersion: store.getEntryVersion(),
    })
  });
  private listController = new EntryListController(this, this.storeController);
  private unsubscribeUrl: (() => void) | null = null;
  private observer: IntersectionObserver | null = null;
  private sentinelRef: Element | null = null;
  private lastTagFilters: string = '';
  private lastHashtagFilters: string = '';
  private lastSortValue: string = '';

  connectedCallback() {
    super.connectedCallback();
    this.lastTagFilters = URLStateManager.getTagFilters().join(',');
    this.lastHashtagFilters = URLStateManager.getHashtagFilters().join(',');
    this.lastSortValue = `${URLStateManager.getSortBy()}-${URLStateManager.getSortOrder()}`;
    // Subscribe to URL changes for filter/sort updates
    this.unsubscribeUrl = URLStateManager.subscribe(() => {
      const currentTags = URLStateManager.getTagFilters().join(',');
      const currentHashtags = URLStateManager.getHashtagFilters().join(',');
      const currentSort = `${URLStateManager.getSortBy()}-${URLStateManager.getSortOrder()}`;

      const tagsChanged = currentTags !== this.lastTagFilters;
      const hashtagsChanged = currentHashtags !== this.lastHashtagFilters;
      const sortChanged = currentSort !== this.lastSortValue;

      if (tagsChanged || hashtagsChanged) {
        this.lastTagFilters = currentTags;
        this.lastHashtagFilters = currentHashtags;
        this.storeController.store?.resetPagination();
      }

      if (tagsChanged || hashtagsChanged || sortChanged) {
        this.lastSortValue = currentSort;
        this.requestUpdate();
      }
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
    const sentinel = this.renderRoot.querySelector('.load-more-sentinel');
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
    const selectedTag = this.listController.getSelectedTag();
    const tagFilters = this.listController.getTagFilters();
    const { sortValue } = this.listController.getSortConfig();
    // Empty state
    if (entries.length === 0) {
      const msg = selectedTag ? `No entries yet for ${selectedTag.name}.` : 'No entries yet.';
      return html`
          <entry-list-header
            .selectedTag=${selectedTag}
            .tagFilters=${tagFilters}
            .currentSortValue=${sortValue}>
          </entry-list-header>
          <div class="empty-state">${msg}</div>
      `;
    }

    const { hasMore, isLoadingMore } = this.listController.getPaginationState();

    return html`
        <entry-list-header
          .selectedTag=${selectedTag}
          .tagFilters=${tagFilters}
          .currentSortValue=${sortValue}>
        </entry-list-header>
        <div class="timeline-entries">
          ${repeat(
      entries,
      (entry) => entry.id,
      (entry) => html`
              <entry-list-item .entry=${entry}></entry-list-item>
            `
    )}
        </div>
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
