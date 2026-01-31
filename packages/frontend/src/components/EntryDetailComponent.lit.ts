import { html, LitElement, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { StoreController } from '../controllers/StoreController.js';
import { EntryDetailController } from '../controllers/EntryDetailController.js';
import './EntryDetailHeader.lit.js';
import './EntryDetailEditor.lit.js';
import './EntryDetailFooter.lit.js';

/**
 * EntryDetail Lit Component
 * Main container for displaying entry details
 * Uses Reactive Controllers for separation of concerns:
 * - StoreController: Manages store connection
 * - EntryDetailController: Handles entry loading, editing, and operations
 *
 * Sub-components:
 * - EntryDetailHeader: Entity chip, timestamp, menu
 * - EntryDetailEditor: Milkdown markdown editor
 * - EntryDetailFooter: Hashtags
 */
@customElement('entry-detail')
export class EntryDetailComponent extends LitElement {
  static styles = css`
    :host {
      display: flex;
      height: 100%;
      padding: var(--base-size-24) !important;
      flex-direction: column;
      overscroll-behavior: contain;
    }

    .entry-detail-title {
      display: block;
      border: none;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1.3;
      background: none;
      resize: none;
      overflow: hidden;
      font-family: inherit;
      word-break: break-word;
      overflow-wrap: break-word;
      white-space: pre-wrap;
      field-sizing: content;
      min-height: 1lh;
    }

    .entry-detail-title:focus-visible {
      border: none;
      outline: none;
    }

    entry-detail-editor {
      display: flex;
      flex: 1;
    }

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
      gap: var(--base-size-16);
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
  `;

  // Controllers handle all logic
  private storeController = new StoreController(this);
  private detailController = new EntryDetailController(this, this.storeController);

  connectedCallback(): void {
    super.connectedCallback();

    // Add beforeunload handler to save changes
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    // Add visibility change handler to save when tab becomes hidden
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    // Remove event listeners
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    // Flush any pending saves
    this.detailController.flushPendingSaves();
  }

  private handleBeforeUnload = (): void => {
    if (this.detailController.hasUnsavedChanges) {
      this.detailController.flushPendingSaves();
    }
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden && this.detailController.hasUnsavedChanges) {
      console.log('[AutoSave] Tab becoming hidden - flushing pending save');
      this.detailController.flushPendingSaves();
    }
  };

  private handleTitleChange = (e: InputEvent): void => {
    const input = e.target as HTMLTextAreaElement;
    // Remove any newlines that might be pasted
    this.detailController.updateTitle(input.value.replace(/\n/g, ''));
  };

  private handleTitleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  private handleNotesChange = (e: CustomEvent): void => {
    const { notes } = e.detail;
    this.detailController.updateNotes(notes);
  };

  private handleEntityChange = async (e: CustomEvent): Promise<void> => {
    const { entityId, entityName } = e.detail;
    await this.detailController.updateEntity(entityId, entityName);
  };

  private handleMenuAction = async (e: CustomEvent): Promise<void> => {
    const { action } = e.detail;

    switch (action) {
      case 'delete':
        await this.detailController.deleteEntry();
        break;
      case 'archive':
        await this.detailController.archiveEntry();
        break;
      case 'copy':
        await this.detailController.copyNotesToClipboard();
        break;
    }
  };

  render() {
    // Ensure entry is loaded when store becomes available (handles page refresh)
    this.detailController.ensureLoaded();

    // Check if store is available and loaded
    if (!this.storeController.store || !this.storeController.isLoaded) {
      return html`
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading entry...</p>
          </div>
      `;
    }

    // Check if we have an entry to display
    if (!this.detailController.entry || !this.detailController.entity) {
      return html`
          <div class="empty-state">Entry not found</div>
      `;
    }

    const entry = this.detailController.entry;
    const entity = this.detailController.entity;
    const allEntities = this.detailController.getAllEntities();
    const hashtags = this.detailController.getHashtags();

    return html`
          <entry-detail-header
            .entry=${entry}
            .entity=${entity}
            .allEntities=${allEntities}
            @entity-change=${this.handleEntityChange}
            @menu-action=${this.handleMenuAction}>
          </entry-detail-header>

          <textarea
            class="entry-detail-title"
            .value=${this.detailController.editedTitle}
            @input=${this.handleTitleChange}
            @keydown=${this.handleTitleKeydown}
            placeholder="Entry title"
            rows="1"></textarea>

          <entry-detail-editor
            .notes=${this.detailController.editedNotes}
            @notes-change=${this.handleNotesChange}>
          </entry-detail-editor>

          <entry-detail-footer
            .entry=${entry}
            .hashtags=${hashtags}>
          </entry-detail-footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entry-detail': EntryDetailComponent;
  }
}
