import { ReactiveController, ReactiveControllerHost } from 'lit';
import { StoreController } from '../../../core/controllers/StoreController.js';
import { Entry } from '../models/Entry.js';
import { Tag } from '../../tags/models/Tag.js';
import { IpoCategory } from '../../../types/index.js';
import { debounce } from '../../../core/utils/helpers.js';
import { extractHashtags } from '../utils/entryHelpers.js';
import { URLStateManager } from '../../../core/utils/urlState.js';
import { toast } from '../../../core/utils/toast.js';
import { APIClient } from '../../../core/api/client.js';

/**
 * Reactive Controller for Entry Detail logic
 * Handles entry retrieval, editing state, auto-save, and property management
 */
export class EntryDetailController implements ReactiveController {
  private host: ReactiveControllerHost;
  private storeController: StoreController;
  private unsubscribeUrl: (() => void) | null = null;
  private unsubscribeStore: (() => void) | null = null;

  public entryId: string | null = null;
  public entry: Entry | null = null;
  public editedTitle: string = '';
  public editedNotes: string = '';
  public hasUnsavedChanges: boolean = false;
  public isLoading: boolean = false;

  // Debounced save function
  private debouncedBackendSave: ReturnType<typeof debounce> | null = null;

  constructor(host: ReactiveControllerHost, storeController: StoreController) {
    this.host = host;
    this.storeController = storeController;
    host.addController(this);
  }

  hostConnected() {
    // Subscribe to URL changes
    this.unsubscribeUrl = URLStateManager.subscribe(() => {
      this.updateFromUrl();
    });

    // Subscribe to store changes (to reload entry when store loads data)
    if (this.storeController.store) {
      this.unsubscribeStore = this.storeController.store.subscribe(() => {
        if (this.storeController.isLoaded && this.entryId && !this.entry) {
          // Store just loaded and we don't have entry yet - try loading it
          this.loadEntry();
        }
      });
    }

    // Initialize from current URL (will retry when store loads)
    this.updateFromUrl();

    // Setup auto-save debouncer (saves 2 seconds after last edit)
    this.debouncedBackendSave = debounce(async (entryId: string) => {
      await this.saveToBackend(entryId);
    }, 2000);
  }

  hostDisconnected() {
    if (this.unsubscribeUrl) {
      this.unsubscribeUrl();
      this.unsubscribeUrl = null;
    }

    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }

    // Flush any pending saves before disconnect
    if (this.hasUnsavedChanges && this.entryId) {
      this.debouncedBackendSave?.flush();
    }
  }

  /**
   * Update controller state from URL
   */
  private updateFromUrl(): void {
    // Check if URL has ?id= query param for entry detail
    const params = new URLSearchParams(window.location.search);
    const newEntryId = params.get('id');

    if (!newEntryId) {
      // Flush any pending saves before clearing the entry
      if (this.hasUnsavedChanges && this.entryId) {
        this.flushPendingSaves();
      }
      this.entryId = null;
      this.entry = null;
      this.host.requestUpdate();
      return;
    }

    if (newEntryId !== this.entryId) {
      // Flush any pending saves before switching entries
      if (this.hasUnsavedChanges && this.entryId) {
        this.flushPendingSaves();
      }

      this.entryId = newEntryId;

      // Only try to load if store is available
      if (this.storeController.store) {
        this.loadEntry();
      }
    }
  }

  /**
   * Ensure the entry is loaded when store becomes available
   * Call this from render to handle late store initialization
   */
  ensureLoaded(): void {
    // Try to set up store subscription if not already done
    if (!this.unsubscribeStore && this.storeController.store) {
      this.unsubscribeStore = this.storeController.store.subscribe(() => {
        if (this.storeController.isLoaded && this.entryId && !this.entry) {
          this.loadEntry();
        }
      });
    }

    // Try to load entry if we have the ID but not the entry
    if (this.storeController.isLoaded && this.entryId && !this.entry) {
      this.loadEntry();
    }
  }

  /**
   * Load entry data from store or fetch from API if not found
   */
  private async loadEntry(): Promise<void> {
    const store = this.storeController.store;
    if (!store || !this.entryId) {
      this.entry = null;
      this.isLoading = false;
      this.host.requestUpdate();
      return;
    }

    // First try to get from local store
    this.entry = store.getEntryById(this.entryId) ?? null;

    // If not found locally, fetch from API (e.g., opened from search)
    if (!this.entry) {
      this.isLoading = true;
      this.host.requestUpdate();

      try {
        const entryData = await APIClient.getEntry(this.entryId);
        this.entry = new Entry(entryData);
        // Add to store so subsequent operations (archive, delete, update) work
        store.addEntryToCache(this.entry);
      } catch (error) {
        console.error('Failed to fetch entry:', error);
        this.entry = null;
      }

      this.isLoading = false;
    }

    if (this.entry) {
      this.editedTitle = this.entry.title || '';
      this.editedNotes = this.entry.notes || '';
      this.hasUnsavedChanges = false;
    }

    this.host.requestUpdate();
  }

  /**
   * Update entry title (called during editing)
   */
  updateTitle(title: string): void {
    this.editedTitle = title;
    this.checkUnsavedChanges();

    // Trigger debounced auto-save
    if (this.hasUnsavedChanges && this.entryId) {
      this.debouncedBackendSave?.(this.entryId);
    }
  }

  /**
   * Update entry notes (called during editing)
   */
  updateNotes(notes: string): void {
    this.editedNotes = notes;
    this.checkUnsavedChanges();

    // Trigger debounced auto-save
    if (this.hasUnsavedChanges && this.entryId) {
      this.debouncedBackendSave?.(this.entryId);
    }
  }

  /**
   * Check if there are unsaved changes
   */
  private checkUnsavedChanges(): void {
    if (!this.entry) {
      this.hasUnsavedChanges = false;
      return;
    }
    this.hasUnsavedChanges =
      this.editedTitle !== (this.entry.title || '') ||
      this.editedNotes !== (this.entry.notes || '');
  }

  /**
   * Save entry to backend
   */
  async saveToBackend(entryId: string, options?: { keepalive?: boolean }): Promise<void> {
    const store = this.storeController.store;
    if (!store) return;

    const entry = store.getEntryById(entryId);
    if (!entry) {
      console.error('[AutoSave] Entry not found:', entryId);
      return;
    }

    const titleToSave = this.editedTitle;
    const notesToSave = this.editedNotes;

    try {
      await store.updateEntry(entryId, { title: titleToSave, notes: notesToSave }, { keepalive: options?.keepalive });

      this.hasUnsavedChanges = false;
      this.host.requestUpdate();
    } catch (error) {
      console.error('[AutoSave] Save failed:', error);
      toast.error('Failed to save changes');
    }
  }

  /**
   * Delete current entry
   */
  async deleteEntry(): Promise<void> {
    if (!this.entry || !this.storeController.store) return;

    const entryToDelete = this.entry;

    toast.show({
      message: 'Entry deleted',
      type: 'success',
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: async () => {
          try {
            await this.storeController.store!.addEntry(entryToDelete);
            toast.success('Entry restored');
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            toast.error(`Failed to restore entry: ${message}`);
          }
        }
      }
    });

    try {
      await this.storeController.store.deleteEntry(this.entry.id);
      URLStateManager.goBack();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error deleting entry: ${message}`);
    }
  }

  /**
   * Archive current entry
   */
  async archiveEntry(): Promise<void> {
    if (!this.entry || !this.storeController.store) return;

    // Show success toast and navigate immediately (optimistic update)
    toast.success('Entry archived successfully');
    URLStateManager.goBack();

    try {
      await this.storeController.store.archiveEntry(this.entry.id, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error archiving entry: ${message}`);
    }
  }

  /**
   * Update entry tags (replaces all tags with the selected one)
   */
  async updateTag(newTagId: string, _newTagName: string): Promise<void> {
    if (!this.entry || !this.storeController.store) return;

    try {
      await this.storeController.store.updateEntry(this.entry.id, {
        tagIds: [newTagId]
      });

      // Reload entry to get updated data
      this.loadEntry();
    } catch (error) {
      console.error('Error updating entry tag:', error);
      toast.error('Failed to update tag');
    }
  }

  /**
   * Update entry IPO category
   */
  async updateIpoCategory(ipoCategory: IpoCategory | null): Promise<void> {
    if (!this.entry || !this.storeController.store) return;

    // Optimistic update
    this.entry = new Entry({
      ...this.entry,
      ipoCategory: ipoCategory || undefined
    });
    this.host.requestUpdate();

    try {
      await this.storeController.store.updateEntry(this.entry.id, {
        ipoCategory
      });
    } catch (error) {
      console.error('Error updating IPO category:', error);
      toast.error('Failed to update IPO category');
      // Reload entry to revert
      this.loadEntry();
    }
  }

  /**
   * Copy notes to clipboard
   */
  async copyNotesToClipboard(): Promise<void> {
    if (!this.entry?.notes) return;

    try {
      await navigator.clipboard.writeText(this.entry.notes);
      toast.success('Notes copied to clipboard');
    } catch (error) {
      console.error('Failed to copy notes:', error);
      toast.error('Failed to copy notes');
    }
  }

  /**
   * Get extracted hashtags from title and notes
   */
  getHashtags(): string[] {
    if (!this.entry) return [];
    const titleTags = this.entry.title ? extractHashtags(this.entry.title) : [];
    const notesTags = this.entry.notes ? extractHashtags(this.entry.notes) : [];
    // Deduplicate
    return [...new Set([...titleTags, ...notesTags])];
  }

  /**
   * Check if URL is safe for display
   */
  isSafeUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const allowedProtocols = ['http:', 'https:'];
      return allowedProtocols.includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Get all tags for dropdown
   */
  getAllTags(): Tag[] {
    return this.storeController.store?.getTags() || [];
  }

  /**
   * Flush any pending saves (call before navigation/unload)
   * Uses keepalive to ensure request completes even if page is closing
   */
  flushPendingSaves(): void {
    if (this.hasUnsavedChanges && this.entryId) {
      // Cancel the debounced timer
      this.debouncedBackendSave?.cancel();
      // Save immediately with keepalive to ensure it completes
      this.saveToBackend(this.entryId, { keepalive: true });
    }
  }
}
