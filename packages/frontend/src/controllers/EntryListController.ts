import { ReactiveController, ReactiveControllerHost } from 'lit';
import { StoreController } from './StoreController.js';
import { Entry } from '../models/Entry.js';
import { Entity } from '../models/Entity.js';
import { extractHashtags } from '../utils/entryHelpers.js';
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
   */
  getFilteredEntries(): Entry[] {
    const store = this.storeController.store;
    if (!store) return [];

    let entries = store.getEntries();

    // Filter by selected entity
    const selectedEntityId = store.getSelectedEntityId();
    if (selectedEntityId) {
      entries = entries.filter(e => e.entityId === selectedEntityId);
    }

    // Filter by tags
    const tagFilters = URLStateManager.getTagFilters();
    if (tagFilters.length > 0) {
      entries = entries.filter(e => {
        if (!e.notes) return false;
        const entryTags = extractHashtags(e.notes);
        return tagFilters.every(tag => entryTags.some(et => et.toLowerCase() === tag.toLowerCase()));
      });
    }

    return entries;
  }

  /**
   * Get selected entity if any
   */
  getSelectedEntity(): Entity | null {
    const store = this.storeController.store;
    if (!store) return null;

    const selectedEntityId = store.getSelectedEntityId();
    return selectedEntityId ? store.getEntityById(selectedEntityId) : null;
  }

  /**
   * Get current tag filters
   */
  getTagFilters(): string[] {
    return URLStateManager.getTagFilters();
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
   * Get all entries for header (used for tag extraction)
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
