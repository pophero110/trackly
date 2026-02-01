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
      font-family: inherit;
      word-break: break-word;
      overflow-wrap: break-word;
      white-space: pre-wrap;
      min-height: 1lh;
    }

    .entry-detail-title:focus-visible {
      border: none;
      outline: none;
    }

    .entry-detail-title:empty::before {
      content: attr(data-placeholder);
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
  private titleElement?: HTMLDivElement;

  @state()
  private autocompleteOpen: boolean = false;

  @state()
  private autocompleteQuery: string = '';

  @state()
  private triggerIndex: number = -1;

  @state()
  private titleRect: DOMRect | null = null;

  // Track current entry ID to know when to reset title content
  private currentEntryId: string | null = null;

  protected updated(): void {
    // Set title content only when entry changes (not on every state update)
    const entryId = this.detailController.entry?.id ?? null;
    if (entryId !== this.currentEntryId) {
      this.currentEntryId = entryId;
      if (this.titleElement && this.detailController.editedTitle) {
        this.titleElement.textContent = this.detailController.editedTitle;
      }
    }
  }

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
    const div = e.target as HTMLDivElement;
    // Use textContent to get plain text without HTML
    const text = div.textContent || '';
    // Remove any newlines that might be pasted
    const cleanText = text.replace(/\n/g, '');
    this.detailController.updateTitle(cleanText);

    // Check for # trigger for tag autocomplete
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      this.closeAutocomplete();
      return;
    }

    // Get cursor position in text
    const range = selection.getRangeAt(0);
    const cursorPos = range.startOffset;

    // Find the last # before cursor
    const textBeforeCursor = cleanText.substring(0, cursorPos);
    const hashIndex = textBeforeCursor.lastIndexOf('#');

    if (hashIndex !== -1) {
      const textAfterHash = textBeforeCursor.substring(hashIndex + 1);
      // Only show dropdown if no space after # (tag still being typed)
      if (!textAfterHash.includes(' ')) {
        this.triggerIndex = hashIndex;
        this.autocompleteQuery = textAfterHash;
        this.titleRect = div.getBoundingClientRect();
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

    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  private handleTagSelected = (e: CustomEvent<{ tagName: string }>): void => {
    const div = this.titleElement;
    if (!div) return;

    const { tagName } = e.detail;
    const text = div.textContent || '';

    // Get current cursor position
    const selection = window.getSelection();
    const cursorPos = selection?.rangeCount ? selection.getRangeAt(0).startOffset : text.length;

    // Replace from trigger index to cursor with the selected tag
    const beforeTrigger = text.substring(0, this.triggerIndex);
    const afterCursor = text.substring(cursorPos);
    const newText = `${beforeTrigger}#${tagName} ${afterCursor}`;

    div.textContent = newText;
    this.detailController.updateTitle(newText);

    // Position cursor after inserted tag
    const newCursorPos = this.triggerIndex + 1 + tagName.length + 1;
    this.setCursorPosition(div, newCursorPos);

    this.closeAutocomplete();
  };

  private handleDropdownClose = (): void => {
    this.closeAutocomplete();
  };

  private closeAutocomplete(): void {
    this.autocompleteOpen = false;
    this.autocompleteQuery = '';
    this.triggerIndex = -1;
    this.titleRect = null;
  }

  private setCursorPosition(element: HTMLElement, position: number): void {
    const range = document.createRange();
    const selection = window.getSelection();
    const textNode = element.firstChild;

    if (textNode && selection) {
      const safePos = Math.min(position, textNode.textContent?.length || 0);
      range.setStart(textNode, safePos);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
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

          <div
            class="entry-detail-title"
            contenteditable="true"
            data-placeholder="Entry title"
            @input=${this.handleTitleChange}
            @keydown=${this.handleTitleKeydown}></div>

          <tag-autocomplete-dropdown
            .tags=${tagNames}
            .query=${this.autocompleteQuery}
            .open=${this.autocompleteOpen}
            .anchorRect=${this.titleRect}
            @tag-selected=${this.handleTagSelected}
            @dropdown-close=${this.handleDropdownClose}>
          </tag-autocomplete-dropdown>

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
