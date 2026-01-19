import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { StoreController } from '../controllers/StoreController.js';
import { EntryDetailController } from '../controllers/EntryDetailController.js';
import './EntryDetailHeader.lit.js';
import './EntryDetailProperties.lit.js';
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
 * - EntryDetailProperties: Entry value and custom properties
 * - EntryDetailEditor: Milkdown markdown editor
 * - EntryDetailFooter: Hashtags and location
 */
@customElement('entry-detail')
export class EntryDetailComponent extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }

    .entry-detail-content {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .loading-state,
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: var(--text-secondary, #6B7280);
      gap: 16px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border, #E5E7EB);
      border-top-color: var(--primary, #3B82F6);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
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
      <div class="entry-detail-content">
        <entry-detail-header
          .entry=${entry}
          .entity=${entity}
          .allEntities=${allEntities}
          @entity-change=${this.handleEntityChange}
          @menu-action=${this.handleMenuAction}>
        </entry-detail-header>

        ${when(
          entry.value !== undefined || (entity.properties && entity.properties.length > 0),
          () => html`
            <entry-detail-properties
              .entry=${entry}
              .entity=${entity}>
            </entry-detail-properties>
          `
        )}

        <entry-detail-editor
          .notes=${this.detailController.editedNotes}
          @notes-change=${this.handleNotesChange}>
        </entry-detail-editor>

        <entry-detail-footer
          .entry=${entry}
          .hashtags=${hashtags}>
        </entry-detail-footer>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entry-detail': EntryDetailComponent;
  }
}
