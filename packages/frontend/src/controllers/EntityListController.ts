import { ReactiveController, ReactiveControllerHost } from 'lit';
import { StoreController } from './StoreController.js';
import { Entity } from '../models/Entity.js';
import { URLStateManager } from '../utils/urlState.js';

/**
 * Reactive Controller for Entity List logic
 * Handles sorting and data preparation for entity lists
 */
export class EntityListController implements ReactiveController {
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
    const sortBy = URLStateManager.getEntitySortBy() || 'created';
    const sortOrder = URLStateManager.getEntitySortOrder() || 'desc';
    const sortValue = `${sortBy}-${sortOrder}`;

    return { sortBy, sortOrder, sortValue };
  }

  /**
   * Get sorted entities based on current sort configuration
   */
  getSortedEntities(): Entity[] {
    const store = this.storeController.store;
    if (!store) return [];

    const { sortBy, sortOrder } = this.getSortConfig();
    return this.sortEntities(store.getEntities(), sortBy, sortOrder);
  }

  /**
   * Sort entities by various criteria
   */
  private sortEntities(entities: Entity[], sortBy: string, sortOrder: 'asc' | 'desc'): Entity[] {
    const store = this.storeController.store;
    if (!store) return entities;

    const sorted = [...entities];

    switch (sortBy) {
      case 'created':
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return sortOrder === 'desc' ? sorted.reverse() : sorted;

      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        return sortOrder === 'desc' ? sorted.reverse() : sorted;

      case 'entries':
        const entryCounts = new Map<string, number>();
        sorted.forEach(entity => {
          entryCounts.set(entity.id, store.getEntriesByEntityId(entity.id, false).length);
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
   * Check if entity is selected
   */
  isEntitySelected(entityId: string): boolean {
    const store = this.storeController.store;
    if (!store) return false;

    return store.getSelectedEntityId() === entityId;
  }
}
