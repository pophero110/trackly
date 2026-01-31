import { ReactiveController, ReactiveControllerHost } from 'lit';
import { StoreController } from './StoreController.js';
import { Tag } from '../models/Tag.js';
import { URLStateManager } from '../utils/urlState.js';

/**
 * Reactive Controller for Tag List logic
 * Handles sorting and data preparation for tag lists
 */
export class TagListController implements ReactiveController {
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
   * Get current sort configuration
   */
  getSortConfig(): { sortBy: string; sortOrder: 'asc' | 'desc'; sortValue: string } {
    const sortBy = URLStateManager.getTagSortBy() || 'created';
    const sortOrder = URLStateManager.getTagSortOrder() || 'desc';
    const sortValue = `${sortBy}-${sortOrder}`;

    return { sortBy, sortOrder, sortValue };
  }

  /**
   * Get sorted tags based on current sort configuration
   */
  getSortedTags(): Tag[] {
    const store = this.storeController.store;
    if (!store) return [];

    const { sortBy, sortOrder } = this.getSortConfig();
    return this.sortTags(store.getTags(), sortBy, sortOrder);
  }

  /**
   * Sort tags by various criteria
   */
  private sortTags(tags: Tag[], sortBy: string, sortOrder: 'asc' | 'desc'): Tag[] {
    const store = this.storeController.store;
    if (!store) return tags;

    const sorted = [...tags];

    switch (sortBy) {
      case 'created':
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return sortOrder === 'desc' ? sorted.reverse() : sorted;

      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        return sortOrder === 'desc' ? sorted.reverse() : sorted;

      case 'entries':
        const entryCounts = new Map<string, number>();
        sorted.forEach(tag => {
          entryCounts.set(tag.id, store.getEntriesByTagId(tag.id, false).length);
        });
        sorted.sort((a, b) => {
          return (entryCounts.get(a.id) || 0) - (entryCounts.get(b.id) || 0);
        });
        return sortOrder === 'desc' ? sorted.reverse() : sorted;

      case 'type':
        sorted.sort((a, b) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name);
          }
          return a.type.localeCompare(b.type);
        });
        return sortOrder === 'desc' ? sorted.reverse() : sorted;

      default:
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return sorted;
    }
  }

  /**
   * Check if tag is selected
   */
  isTagSelected(tagId: string): boolean {
    const store = this.storeController.store;
    if (!store) return false;

    return store.getSelectedTagId() === tagId;
  }
}
