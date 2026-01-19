import { ReactiveController, ReactiveControllerHost } from 'lit';
import { StoreController } from './StoreController.js';
import { Entry } from '../models/Entry.js';
import { Entity } from '../models/Entity.js';
import { extractHashtags, debounce } from '../utils/helpers.js';
import { URLStateManager } from '../utils/urlState.js';
import { toast } from '../utils/toast.js';

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
  public entity: Entity | null = null;
  public editedNotes: string = '';
  public hasUnsavedChanges: boolean = false;

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
      await this.saveToBackend(entryId, { silent: true });
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
    const store = this.storeController.store;
    if (!store) return;

    const currentPath = window.location.pathname;

    // Check if we're on entry detail page (/entries/:id)
    if (!currentPath.startsWith('/entries/')) {
      this.entryId = null;
      this.entry = null;
      this.entity = null;
      this.host.requestUpdate();
      return;
    }

    // Extract entry ID from URL
    const pathSegments = currentPath.split('/').filter(Boolean);
    const newEntryId = pathSegments[1] || null;

    if (newEntryId !== this.entryId) {
      // Flush any pending saves before switching entries
      if (this.hasUnsavedChanges && this.entryId) {
        this.debouncedBackendSave?.flush();
      }

      this.entryId = newEntryId;
      this.loadEntry();
    }
  }

  /**
   * Load entry data from store
   */
  private loadEntry(): void {
    const store = this.storeController.store;
    if (!store || !this.entryId) {
      this.entry = null;
      this.entity = null;
      this.host.requestUpdate();
      return;
    }

    this.entry = store.getEntryById(this.entryId);
    if (this.entry) {
      this.entity = store.getEntityById(this.entry.entityId);
      this.editedNotes = this.entry.notes || '';
      this.hasUnsavedChanges = false;
    }

    this.host.requestUpdate();
  }

  /**
   * Update entry notes (called during editing)
   */
  updateNotes(notes: string): void {
    this.editedNotes = notes;
    this.hasUnsavedChanges = this.entry ? this.editedNotes !== this.entry.notes : false;

    // Trigger debounced auto-save
    if (this.hasUnsavedChanges && this.entryId) {
      this.debouncedBackendSave?.(this.entryId);
    }
  }

  /**
   * Save entry to backend
   */
  async saveToBackend(entryId: string, options?: { keepalive?: boolean; silent?: boolean }): Promise<void> {
    const store = this.storeController.store;
    if (!store) return;

    const entry = store.getEntryById(entryId);
    if (!entry) {
      console.error('[AutoSave] Entry not found:', entryId);
      return;
    }

    const notesToSave = this.editedNotes;

    try {
      await store.updateEntry(entryId, { notes: notesToSave }, { keepalive: options?.keepalive });

      if (!options?.silent) {
        console.log('[AutoSave] Saved successfully');
      }

      this.hasUnsavedChanges = false;
      this.host.requestUpdate();
    } catch (error) {
      console.error('[AutoSave] Save failed:', error);
      if (!options?.silent) {
        toast.error('Failed to save changes');
      }
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
   * Update entry entity
   */
  async updateEntity(newEntityId: string, newEntityName: string): Promise<void> {
    if (!this.entry || !this.storeController.store) return;

    try {
      await this.storeController.store.updateEntry(this.entry.id, {
        entityId: newEntityId,
        entityName: newEntityName
      });

      // Reload entry to get updated data
      this.loadEntry();
    } catch (error) {
      console.error('Error updating entry entity:', error);
      toast.error('Failed to update entity');
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
   * Get extracted hashtags from notes
   */
  getHashtags(): string[] {
    if (!this.entry?.notes) return [];
    return extractHashtags(this.entry.notes);
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
   * Get all entities for dropdown
   */
  getAllEntities(): Entity[] {
    return this.storeController.store?.getEntities() || [];
  }

  /**
   * Flush any pending saves (call before navigation/unload)
   */
  flushPendingSaves(): void {
    if (this.hasUnsavedChanges && this.entryId) {
      this.debouncedBackendSave?.flush();
    }
  }
}
