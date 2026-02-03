import { Tag } from '../models/Tag.js';
import { Entry } from '../models/Entry.js';
import { ITag, IEntry, StoreListener, Unsubscribe, IpoCategory } from '../types/index.js';
import { APIClient } from '../api/client.js';
import { URLStateManager } from '../utils/urlState.js';
import type { PaginationCursor } from '@trackly/shared';

/**
 * Central state management store - API-backed
 */
export class Store {
  private tags: Tag[];
  private entries: Entry[];
  private listeners: StoreListener[];
  private selectedTagId: string | null;
  private isLoaded: boolean;
  private entryVersion: number;
  private paginationState: {
    hasMore: boolean;
    nextCursor: PaginationCursor | null;
    isLoadingMore: boolean;
  };

  constructor() {
    this.tags = [];
    this.entries = [];
    this.listeners = [];
    this.selectedTagId = null;
    this.isLoaded = false;
    this.entryVersion = 0;
    this.paginationState = {
      hasMore: true,
      nextCursor: null,
      isLoadingMore: false
    };

    // Load data with initial sort from URL if present
    const sortBy = URLStateManager.getSortBy() || undefined;
    const sortOrder = URLStateManager.getSortOrder() || undefined;
    this.loadData(sortBy, sortOrder);
  }

  // Load data from API
  private async loadData(sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<void> {
    try {
      const hashtagFilters = URLStateManager.getHashtagFilters();

      // Fetch tags first so we can resolve tag name filters to IDs
      const tagsData = await APIClient.getTags();
      this.tags = tagsData.map(data => new Tag(data));

      const tagIds = this.getFilterTagIds();
      const entriesResponse = await APIClient.getEntries({
        tagIds,
        sortBy,
        sortOrder,
        limit: 30,
        hashtags: hashtagFilters.length > 0 ? hashtagFilters : undefined
      });

      this.entries = entriesResponse.entries.map(data => new Entry(data));
      this.paginationState = {
        hasMore: entriesResponse.pagination.hasMore,
        nextCursor: entriesResponse.pagination.nextCursor,
        isLoadingMore: false
      };
      this.isLoaded = true;
      this.notifyEntryChange();
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

  // Increment entry version and notify (for entry mutations)
  private notifyEntryChange(): void {
    this.entryVersion++;
    this.notify();
  }

  // Get combined tag IDs for filtering (selectedTagId + URL tag filters)
  private getFilterTagIds(): string[] | undefined {
    const tagIds: string[] = [];

    // Add selected tag from sidebar
    if (this.selectedTagId) {
      tagIds.push(this.selectedTagId);
    }

    // Add tag filters from URL (convert names to IDs)
    const tagFilters = URLStateManager.getTagFilters();
    for (const tagName of tagFilters) {
      const tag = this.tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
      if (tag && !tagIds.includes(tag.id)) {
        tagIds.push(tag.id);
      }
    }

    return tagIds.length > 0 ? tagIds : undefined;
  }

  // Tag operations
  getTags(): Tag[] {
    return [...this.tags];
  }

  getTagById(id: string): Tag | undefined {
    return this.tags.find(t => t.id === id);
  }

  getTagByName(name: string): Tag | undefined {
    return this.tags.find(t => t.name === name);
  }

  async addTag(tag: Tag): Promise<void> {
    const errors = tag.validate();
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    if (this.tags.some(t => t.name === tag.name)) {
      throw new Error('A tag with this name already exists');
    }

    // Create tag via API
    const created = await APIClient.createTag({
      name: tag.name,
      type: tag.type,
      categories: tag.categories,
      valueType: tag.valueType,
      options: tag.options,
      properties: tag.properties
    });

    this.tags.push(new Tag(created));
    this.notify();
  }

  async updateTag(id: string, updates: Partial<ITag>): Promise<void> {
    const index = this.tags.findIndex(t => t.id === id);
    if (index === -1) {
      throw new Error('Tag not found');
    }

    // Update via API
    const updated = await APIClient.updateTag(id, updates);
    this.tags[index] = new Tag(updated);

    const errors = this.tags[index].validate();
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    this.notify();
  }

  async deleteTag(id: string): Promise<void> {
    // Delete via API (cascade deletes entries on backend)
    await APIClient.deleteTag(id);

    this.tags = this.tags.filter(t => t.id !== id);
    // Remove entries that have this tag (cascade delete handled on backend)
    this.entries = this.entries.filter(e => !e.hasTag(id));
    this.notify();
  }

  // Entry operations
  getEntries(): Entry[] {
    // Filter out archived entries by default
    return this.entries.filter(e => !e.isArchived);
  }

  getEntriesByTagId(tagId: string, includeArchived: boolean = false): Entry[] {
    if (includeArchived) {
      return this.entries.filter(e => e.hasTag(tagId));
    }
    // Filter out archived entries by default
    return this.entries.filter(e => e.hasTag(tagId) && !e.isArchived);
  }

  getEntryById(id: string): Entry | undefined {
    return this.entries.find(e => e.id === id);
  }

  /**
   * Add an entry to local cache without API call.
   * Used when fetching an entry directly (e.g., from search results).
   */
  addEntryToCache(entry: Entry): void {
    // Only add if not already in cache
    if (!this.entries.find(e => e.id === entry.id)) {
      this.entries.push(entry);
    }
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
    this.notifyEntryChange(); // Trigger immediate re-render

    try {
      // Create entry via API in the background
      const createdEntry = await APIClient.createEntry({
        tagIds: entry.tagIds,
        title: entry.title,
        timestamp: entry.timestamp,
        notes: entry.notes,
        ipoCategory: entry.ipoCategory
      });

      // Replace optimistic entry with real entry from server
      const index = this.entries.findIndex(e => e.id === tempId);
      if (index !== -1) {
        this.entries[index] = new Entry(createdEntry);
      }

      // Sort locally instead of reloading from API
      this.sortEntriesLocally();
      this.notifyEntryChange();
    } catch (error) {
      // If API call fails, remove the optimistic entry
      const index = this.entries.findIndex(e => e.id === tempId);
      if (index !== -1) {
        this.entries.splice(index, 1);
        this.notifyEntryChange();
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

  async updateEntry(id: string, updates: { tagIds?: string[]; title?: string; timestamp?: string; notes?: string; ipoCategory?: IpoCategory | null }, options?: { keepalive?: boolean }): Promise<void> {
    // Optimistic update: Update entry in local state immediately
    const index = this.entries.findIndex(e => e.id === id);
    if (index !== -1) {
      // Store original entry for rollback
      const originalEntry = this.entries[index];

      // Apply updates optimistically (excluding tagIds which needs server response)
      const { tagIds, ...entryUpdates } = updates;
      this.entries[index] = new Entry({ ...this.entries[index], ...entryUpdates });
      this.notifyEntryChange();

      try {
        // Update via API in the background
        const updatedEntry = await APIClient.updateEntry(id, updates, { keepalive: options?.keepalive ?? false });

        // Update local entry with server response (includes proper tags)
        this.entries[index] = new Entry(updatedEntry);

        // If timestamp changed, re-sort locally (no API call needed)
        if (updates.timestamp) {
          this.sortEntriesLocally();
        }
        this.notifyEntryChange();
      } catch (error) {
        // If API call fails, rollback to original entry
        this.entries[index] = originalEntry;
        this.notifyEntryChange();
        throw error;
      }
    } else {
      // Entry not in local state, just call API
      await APIClient.updateEntry(id, updates, { keepalive: options?.keepalive ?? false });
    }
  }

  async deleteEntry(id: string): Promise<void> {
    const index = this.entries.findIndex(e => e.id === id);

    // If entry is in local state, do optimistic update
    if (index !== -1) {
      // Store original entry for rollback
      const originalEntry = this.entries[index];

      // Remove from local state
      this.entries.splice(index, 1);
      this.notifyEntryChange(); // Trigger immediate re-render

      try {
        // Delete via API in the background
        await APIClient.deleteEntry(id);
        // Entry already removed from local state, no reload needed
      } catch (error) {
        // If API call fails, restore the entry
        this.entries.splice(index, 0, originalEntry);
        this.notifyEntryChange();
        throw error;
      }
    } else {
      // Entry not in local state (e.g., navigated away already), just call API
      await APIClient.deleteEntry(id);
    }
  }

  async archiveEntry(id: string, isArchived: boolean = true): Promise<void> {
    const index = this.entries.findIndex(e => e.id === id);

    // If entry is in local state, do optimistic update
    if (index !== -1) {
      // Store original entry for rollback
      const originalEntry = this.entries[index];

      // Optimistic update: Remove from local state immediately
      this.entries.splice(index, 1);
      this.notifyEntryChange(); // Trigger immediate re-render

      try {
        // Archive via API in the background
        await APIClient.archiveEntry(id, isArchived);
        // Entry already removed from local state, no reload needed
      } catch (error) {
        // If API call fails, restore the entry
        this.entries.splice(index, 0, originalEntry);
        this.notifyEntryChange();
        throw error;
      }
    } else {
      // Entry not in local state (e.g., navigated away already), just call API
      await APIClient.archiveEntry(id, isArchived);
    }
  }

  // Selected tag operations
  getSelectedTagId(): string | null {
    return this.selectedTagId;
  }

  setSelectedTagId(tagId: string | null): void {
    const changed = this.selectedTagId !== tagId;
    this.selectedTagId = tagId;
    this.notify();
    // Reload entries with tag filter when selection changes
    if (changed) {
      this.resetPagination();
    }
  }

  // Sort entries locally and notify (public API for sort changes without API call)
  sortEntries(): void {
    this.sortEntriesLocally();
    this.notifyEntryChange();
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

  // Reload entries with sort parameters (resets pagination)
  async reloadEntries(sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<void> {
    await this.resetPagination();
  }

  // Reset pagination and fetch fresh data
  async resetPagination(): Promise<void> {
    this.paginationState = {
      hasMore: true,
      nextCursor: null,
      isLoadingMore: false
    };

    try {
      const sortBy = URLStateManager.getSortBy() || undefined;
      const sortOrder = URLStateManager.getSortOrder() || undefined;
      const hashtagFilters = URLStateManager.getHashtagFilters();
      const tagIds = this.getFilterTagIds();

      const response = await APIClient.getEntries({
        tagIds,
        sortBy,
        sortOrder,
        limit: 30,
        hashtags: hashtagFilters.length > 0 ? hashtagFilters : undefined
      });

      this.entries = response.entries.map(data => new Entry(data));
      this.paginationState = {
        hasMore: response.pagination.hasMore,
        nextCursor: response.pagination.nextCursor,
        isLoadingMore: false
      };
      this.notifyEntryChange();
    } catch (error) {
      console.error('Error resetting pagination:', error);
    }
  }

  // Load more entries (append to existing)
  async loadMoreEntries(): Promise<void> {
    if (!this.paginationState.hasMore || this.paginationState.isLoadingMore) {
      return;
    }
    if (!this.paginationState.nextCursor) {
      return;
    }

    this.paginationState.isLoadingMore = true;
    this.notify();

    try {
      const sortBy = URLStateManager.getSortBy() || 'timestamp';
      const sortOrder = URLStateManager.getSortOrder() || 'desc';
      const hashtagFilters = URLStateManager.getHashtagFilters();
      const tagIds = this.getFilterTagIds();

      const response = await APIClient.getEntries({
        tagIds,
        sortBy,
        sortOrder,
        limit: 30,
        after: this.paginationState.nextCursor.after,
        afterId: this.paginationState.nextCursor.afterId,
        hashtags: hashtagFilters.length > 0 ? hashtagFilters : undefined
      });

      // Append new entries
      const newEntries = response.entries.map(data => new Entry(data));
      this.entries = [...this.entries, ...newEntries];

      this.paginationState = {
        hasMore: response.pagination.hasMore,
        nextCursor: response.pagination.nextCursor,
        isLoadingMore: false
      };

      this.notifyEntryChange();
    } catch (error) {
      console.error('Error loading more entries:', error);
      this.paginationState.isLoadingMore = false;
      this.notify();
    }
  }

  // Get pagination state for UI
  getPaginationState(): { hasMore: boolean; isLoadingMore: boolean } {
    return {
      hasMore: this.paginationState.hasMore,
      isLoadingMore: this.paginationState.isLoadingMore
    };
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

  // Version counter that increments on every entry mutation
  getEntryVersion(): number {
    return this.entryVersion;
  }
}
