import { html, LitElement, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { StoreController } from '../controllers/StoreController.js';
import { EntryDetailController } from '../controllers/EntryDetailController.js';
import './EntryDetailHeader.lit.js';
import './EntryDetailEditor.lit.js';
import './EntryDetailFooter.lit.js';
import './TagAutocompleteDropdown.lit.js';
import type { TagAutocompleteDropdown } from './TagAutocompleteDropdown.lit.js';

/**
 * EntryDetail Lit Component
 * Main container for displaying entry details
 * Uses Reactive Controllers for separation of concerns:
 * - StoreController: Manages store connection
 * - EntryDetailController: Handles entry loading, editing, and operations
 *
 * Sub-components:
 * - EntryDetailHeader: Tag chip, timestamp, menu
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

    .title-container {
      position: relative;
    }

    .entry-detail-title {
      display: block;
      border: none;
      width: 100%;
      box-sizing: border-box;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1.3;
      background: none;
      font-family: inherit;
      padding: 0;
      margin: 0;
      resize: none;
      overflow: hidden;
      min-height: 1.3em;
    }

    .entry-detail-title:focus {
      outline: none;
    }

    .entry-detail-title::placeholder {
      color: var(--text-muted);
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

  // Tag autocomplete state
  @query('tag-autocomplete-dropdown')
  private autocomplete?: TagAutocompleteDropdown;

  @query('.entry-detail-title')
  private titleInput?: HTMLTextAreaElement;

  @state()
  private autocompleteOpen: boolean = false;

  @state()
  private autocompleteQuery: string = '';

  @state()
  private triggerIndex: number = -1;

  @state()
  private inputRect: DOMRect | null = null;

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

  private handleTitleInput = (e: InputEvent): void => {
    const input = e.target as HTMLTextAreaElement;
    // Auto-resize textarea to fit content
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
    const value = input.value;
    const cursorPos = input.selectionStart ?? value.length;

    this.detailController.updateTitle(value);

    // Find the last # before cursor
    const textBeforeCursor = value.substring(0, cursorPos);
    const hashIndex = textBeforeCursor.lastIndexOf('#');

    if (hashIndex !== -1) {
      const textAfterHash = textBeforeCursor.substring(hashIndex + 1);
      // Only show dropdown if no space after # (tag still being typed)
      if (!textAfterHash.includes(' ')) {
        this.triggerIndex = hashIndex;
        this.autocompleteQuery = textAfterHash;
        this.inputRect = input.getBoundingClientRect();
        this.autocompleteOpen = true;
        return;
      }
    }

    this.closeAutocomplete();
  };

  private handleTitleKeydown = (e: KeyboardEvent): void => {
    // If autocomplete is open, forward keys to it
    if (this.autocompleteOpen && this.autocomplete) {
      const consumed = this.autocomplete.handleKeydown(e);
      if (consumed) {
        return;
      }
    }
  };

  private handleTagSelected = (e: CustomEvent<{ tagName: string }>): void => {
    const input = this.titleInput;
    if (!input) return;

    const { tagName } = e.detail;
    const value = input.value;
    const cursorPos = input.selectionStart ?? value.length;

    // Replace from trigger index to cursor with the selected tag
    const beforeTrigger = value.substring(0, this.triggerIndex);
    const afterCursor = value.substring(cursorPos);
    const newValue = `${beforeTrigger}#${tagName} ${afterCursor}`;

    // Update input and controller
    this.detailController.updateTitle(newValue);

    // Position cursor after inserted tag
    this.updateComplete.then(() => {
      const newCursorPos = this.triggerIndex + 1 + tagName.length + 1;
      input.setSelectionRange(newCursorPos, newCursorPos);
      input.focus();
    });

    this.closeAutocomplete();
  };

  private handleDropdownClose = (): void => {
    this.closeAutocomplete();
  };

  private closeAutocomplete(): void {
    this.autocompleteOpen = false;
    this.autocompleteQuery = '';
    this.triggerIndex = -1;
    this.inputRect = null;
  }

  private handleNotesChange = (e: CustomEvent): void => {
    const { notes } = e.detail;
    this.detailController.updateNotes(notes);
  };

  private handleTagChange = async (e: CustomEvent): Promise<void> => {
    const { tagId, tagName } = e.detail;
    await this.detailController.updateTag(tagId, tagName);
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
    if (!this.detailController.entry || this.detailController.entry.tags.length === 0) {
      return html`
          <div class="empty-state">Entry not found</div>
      `;
    }

    const entry = this.detailController.entry;
    const entryTags = entry.tags;
    const allTags = this.detailController.getAllTags();
    const tagNames = allTags.map(t => t.name).sort();
    const hashtags = this.detailController.getHashtags();

    return html`
          <entry-detail-header
            .entry=${entry}
            .entryTags=${entryTags}
            .allTags=${allTags}
            @tag-change=${this.handleTagChange}
            @menu-action=${this.handleMenuAction}>
          </entry-detail-header>

          <div class="title-container">
            <textarea
              class="entry-detail-title"
              placeholder="Entry title"
              rows="1"
              .value=${this.detailController.editedTitle}
              @input=${this.handleTitleInput}
              @keydown=${this.handleTitleKeydown}
            ></textarea>
            <tag-autocomplete-dropdown
              .tags=${tagNames}
              .query=${this.autocompleteQuery}
              .open=${this.autocompleteOpen}
              .anchorRect=${this.inputRect}
              @tag-selected=${this.handleTagSelected}
              @dropdown-close=${this.handleDropdownClose}>
            </tag-autocomplete-dropdown>
          </div>

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
