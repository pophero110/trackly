import { ReactiveController, ReactiveControllerHost } from 'lit';
import { StoreController } from './StoreController.js';
import { Entry } from '../models/Entry.js';
import { Tag } from '../models/Tag.js';
import { URLStateManager } from '../utils/urlState.js';

/**
 * Reactive Controller for Entry List logic
 * Handles filtering, grouping, and data preparation for entry lists
 */
export class EntryListController implements ReactiveController {
  private host: ReactiveControllerHost;
  private storeController: StoreController;

  constructor(host: ReactiveControllerHost, storeController: StoreController) {
    this.host = host;
    this.storeController = storeController;
    host.addController(this);
  }

  hostConnected() {
    // Controller connected
  }

  hostDisconnected() {
    // Controller disconnected
  }

  /**
   * Get filtered entries based on current URL state
   * Note: Hashtag filtering is now handled server-side via API
   */
  getFilteredEntries(): Entry[] {
    const store = this.storeController.store;
    if (!store) return [];

    let entries = store.getEntries();

    // Filter by selected tag
    const selectedTagId = store.getSelectedTagId();
    if (selectedTagId) {
      entries = entries.filter(e => e.tagId === selectedTagId);
    }

    return entries;
  }

  /**
   * Get selected tag if any
   */
  getSelectedTag(): Tag | null {
    const store = this.storeController.store;
    if (!store) return null;

    const selectedTagId = store.getSelectedTagId();
    return selectedTagId ? store.getTagById(selectedTagId) ?? null : null;
  }

  /**
   * Get current hashtag filters
   */
  getHashtagFilters(): string[] {
    return URLStateManager.getHashtagFilters();
  }

  /**
   * Get current sort configuration
   */
  getSortConfig(): { sortBy: string; sortOrder: 'asc' | 'desc'; sortValue: string } {
    const sortBy = URLStateManager.getSortBy() || 'timestamp';
    const sortOrder = URLStateManager.getSortOrder() || 'desc';
    const sortValue = `${sortBy}-${sortOrder}`;

    return { sortBy, sortOrder, sortValue };
  }

  /**
   * Get all entries for header (used for hashtag extraction)
   */
  getAllEntries(): Entry[] {
    const store = this.storeController.store;
    return store ? store.getEntries() : [];
  }

  /**
   * Group entries by date
   */
  groupEntriesByDate(entries: Entry[]): Map<string, Entry[]> {
    const groups = new Map<string, Entry[]>();

    entries.forEach(entry => {
      const date = new Date(entry.timestamp);
      const dateKey = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(entry);
    });

    return groups;
  }

  /**
   * Get pagination state from store
   */
  getPaginationState(): { hasMore: boolean; isLoadingMore: boolean } {
    const store = this.storeController.store;
    if (!store) return { hasMore: false, isLoadingMore: false };
    return store.getPaginationState();
  }

  /**
   * Load more entries
   */
  loadMoreEntries(): void {
    const store = this.storeController.store;
    if (store) {
      store.loadMoreEntries();
    }
  }
}
