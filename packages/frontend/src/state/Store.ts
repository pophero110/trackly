import { Entity } from '../models/Entity.js';
import { Entry } from '../models/Entry.js';
import { IEntity, IEntry, StoreListener, Unsubscribe } from '../types/index.js';
import { APIClient } from '../api/client.js';
import { URLStateManager } from '../utils/urlState.js';

/**
 * Central state management store - API-backed
 */
export class Store {
  private entities: Entity[];
  private entries: Entry[];
  private listeners: StoreListener[];
  private selectedEntityId: string | null;
  private isLoaded: boolean;

  constructor() {
    this.entities = [];
    this.entries = [];
    this.listeners = [];
    this.selectedEntityId = null;
    this.isLoaded = false;

    // Load data with initial sort from URL if present
    const sortBy = URLStateManager.getSortBy() || undefined;
    const sortOrder = URLStateManager.getSortOrder() || undefined;
    this.loadData(sortBy, sortOrder);
  }

  // Load data from API
  private async loadData(sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<void> {
    try {
      const [entitiesData, entriesData] = await Promise.all([
        APIClient.getEntities(),
        APIClient.getEntries({ sortBy, sortOrder, includeArchived: true })
      ]);

      this.entities = entitiesData.map(data => new Entity(data));
      this.entries = entriesData.map(data => new Entry(data));
      this.isLoaded = true;
      this.notify();
    } catch (error) {
      console.error('Error loading data:', error);
      // If we get a 401, the API client will handle redirect to login
    }
  }

  // Subscribe to state changes
  subscribe(listener: StoreListener): Unsubscribe {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners of state change
  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  // Entity operations
  getEntities(): Entity[] {
    return [...this.entities];
  }

  getEntityById(id: string): Entity | undefined {
    return this.entities.find(e => e.id === id);
  }

  getEntityByName(name: string): Entity | undefined {
    return this.entities.find(e => e.name === name);
  }

  async addEntity(entity: Entity): Promise<void> {
    const errors = entity.validate();
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    if (this.entities.some(e => e.name === entity.name)) {
      throw new Error('An entity with this name already exists');
    }

    // Create entity via API
    const created = await APIClient.createEntity({
      name: entity.name,
      type: entity.type,
      categories: entity.categories,
      valueType: entity.valueType,
      options: entity.options,
      properties: entity.properties
    });

    this.entities.push(new Entity(created));
    this.notify();
  }

  async updateEntity(id: string, updates: Partial<IEntity>): Promise<void> {
    const index = this.entities.findIndex(e => e.id === id);
    if (index === -1) {
      throw new Error('Entity not found');
    }

    // Update via API
    const updated = await APIClient.updateEntity(id, updates);
    this.entities[index] = new Entity(updated);

    const errors = this.entities[index].validate();
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    this.notify();
  }

  async deleteEntity(id: string): Promise<void> {
    // Delete via API (cascade deletes entries on backend)
    await APIClient.deleteEntity(id);

    this.entities = this.entities.filter(e => e.id !== id);
    this.entries = this.entries.filter(e => e.entityId !== id);
    this.notify();
  }

  // Entry operations
  getEntries(): Entry[] {
    // Filter out archived entries by default
    return this.entries.filter(e => !e.isArchived);
  }

  getEntriesByEntityId(entityId: string, includeArchived: boolean = false): Entry[] {
    if (includeArchived) {
      return this.entries.filter(e => e.entityId === entityId);
    }
    // Filter out archived entries by default
    return this.entries.filter(e => e.entityId === entityId && !e.isArchived);
  }

  getEntryById(id: string): Entry | undefined {
    return this.entries.find(e => e.id === id);
  }

  async addEntry(entry: Entry): Promise<void> {
    const errors = entry.validate();
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    // Optimistic update: Add entry to local state immediately
    // Generate a temporary ID that will be replaced by the server's ID
    const tempId = `temp-${Date.now()}`;
    const optimisticEntry = new Entry({ ...entry, id: tempId });
    this.entries.unshift(optimisticEntry); // Add to beginning
    this.notify(); // Trigger immediate re-render

    try {
      // Create entry via API in the background
      const createdEntry = await APIClient.createEntry({
        entityId: entry.entityId,
        entityName: entry.entityName,
        timestamp: entry.timestamp,
        value: entry.value,
        valueDisplay: entry.valueDisplay,
        notes: entry.notes,
        images: entry.images,
        links: entry.links,
        linkTitles: entry.linkTitles,
        entryReferences: entry.entryReferences,
        propertyValues: entry.propertyValues,
        propertyValueDisplays: entry.propertyValueDisplays,
        latitude: entry.latitude,
        longitude: entry.longitude,
        locationName: entry.locationName
      });

      // Replace optimistic entry with real entry from server
      const index = this.entries.findIndex(e => e.id === tempId);
      if (index !== -1) {
        this.entries[index] = new Entry(createdEntry);
      }

      // Sort locally instead of reloading from API
      this.sortEntriesLocally();
      this.notify();
    } catch (error) {
      // If API call fails, remove the optimistic entry
      const index = this.entries.findIndex(e => e.id === tempId);
      if (index !== -1) {
        this.entries.splice(index, 1);
        this.notify();
      }
      throw error; // Re-throw so the form can handle the error
    }
  }

  // Update entry in local state only (no API call, no notify)
  updateEntryLocal(id: string, updates: Partial<IEntry>): void {
    const index = this.entries.findIndex(e => e.id === id);
    if (index !== -1) {
      this.entries[index] = new Entry({ ...this.entries[index], ...updates });
      // No notify() - prevents re-renders
      // No API call - local only
    }
  }

  async updateEntry(id: string, updates: Partial<IEntry>, options?: { silent?: boolean; keepalive?: boolean }): Promise<void> {
    // Optimistic update: Update entry in local state immediately
    const index = this.entries.findIndex(e => e.id === id);
    if (index !== -1) {
      // Store original entry for rollback
      const originalEntry = this.entries[index];

      // Apply updates optimistically
      this.entries[index] = new Entry({ ...this.entries[index], ...updates });

      // Always notify subscribers of the optimistic update
      // This ensures all components (like EntryList) re-render with the new data
      this.notify();

      try {
        // Update via API in the background
        await APIClient.updateEntry(id, updates, { keepalive: options?.keepalive ?? false });

        // If timestamp changed, re-sort locally (no API call needed)
        if (updates.timestamp) {
          this.sortEntriesLocally();
          this.notify();
        }
      } catch (error) {
        // If API call fails, rollback to original entry
        this.entries[index] = originalEntry;
        this.notify();
        throw error;
      }
    } else {
      // Entry not in local state, just call API
      await APIClient.updateEntry(id, updates, { keepalive: options?.keepalive ?? false });
    }
  }

  async deleteEntry(id: string): Promise<void> {
    // Optimistic update: Remove entry from local state immediately
    const index = this.entries.findIndex(e => e.id === id);
    if (index === -1) {
      throw new Error('Entry not found');
    }

    // Store original entry for rollback
    const originalEntry = this.entries[index];

    // Remove from local state
    this.entries.splice(index, 1);
    this.notify(); // Trigger immediate re-render

    try {
      // Delete via API in the background
      await APIClient.deleteEntry(id);
      // Entry already removed from local state, no reload needed
    } catch (error) {
      // If API call fails, restore the entry
      this.entries.splice(index, 0, originalEntry);
      this.notify();
      throw error;
    }
  }

  async archiveEntry(id: string, isArchived: boolean = true): Promise<void> {
    const index = this.entries.findIndex(e => e.id === id);
    if (index === -1) {
      throw new Error('Entry not found');
    }

    // Store original entry for rollback
    const originalEntry = this.entries[index];

    // Optimistic update: Remove from local state immediately
    this.entries.splice(index, 1);
    this.notify(); // Trigger immediate re-render

    try {
      // Archive via API in the background
      await APIClient.archiveEntry(id, isArchived);
      // Entry already removed from local state, no reload needed
    } catch (error) {
      // If API call fails, restore the entry
      this.entries.splice(index, 0, originalEntry);
      this.notify();
      throw error;
    }
  }

  // Selected entity operations
  getSelectedEntityId(): string | null {
    return this.selectedEntityId;
  }

  setSelectedEntityId(entityId: string | null): void {
    this.selectedEntityId = entityId;
    this.notify();
  }

  // Sort entries locally and notify (public API for sort changes without API call)
  sortEntries(): void {
    this.sortEntriesLocally();
    this.notify();
  }

  // Sort entries locally based on current URL sort parameters
  private sortEntriesLocally(): void {
    const sortBy = URLStateManager.getSortBy() || 'timestamp';
    const sortOrder = URLStateManager.getSortOrder() || 'desc';

    this.entries.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortBy) {
        case 'createdAt':
          aVal = new Date(a.createdAt || a.timestamp).getTime();
          bVal = new Date(b.createdAt || b.timestamp).getTime();
          break;
        case 'entityName':
          aVal = a.entityName?.toLowerCase() || '';
          bVal = b.entityName?.toLowerCase() || '';
          break;
        case 'timestamp':
        default:
          aVal = new Date(a.timestamp).getTime();
          bVal = new Date(b.timestamp).getTime();
          break;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Reload entries with sort parameters
  async reloadEntries(sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<void> {
    try {
      const entriesData = await APIClient.getEntries({ sortBy, sortOrder, includeArchived: true });
      this.entries = entriesData.map(data => new Entry(data));
      this.notify();
    } catch (error) {
      console.error('Error reloading entries:', error);
    }
  }

  // Check if data is loaded
  getIsLoaded(): boolean {
    return this.isLoaded;
  }

  getSortBy(): string {
    return URLStateManager.getSortBy() || "";
  }

  getSortOrder(): string {
    return URLStateManager.getSortOrder() || "";
  }
}
