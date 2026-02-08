import { html, LitElement, css } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import { StoreController } from '../../../core/controllers/StoreController.js';
import { EntryDetailController } from '../controllers/EntryDetailController.js';
import { TagAutocompleteController } from '../../tags/controllers/TagAutocompleteController.js';
import './EntryDetailHeader.lit.js';
import './EntryDetailEditor.lit.js';
import './EntryDetailFooter.lit.js';
import '../../tags/components/TagAutocompleteDropdown.lit.js';
import type { TagAutocompleteDropdown } from '../../tags/components/TagAutocompleteDropdown.lit.js';

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
      gap: var(--base-size-8);
    }

    .title-container {
      position: relative;
    }

    .entry-detail-title {
      display: block;
      width: 100%;
      box-sizing: border-box;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1.5;
      background: none;
      font-family: inherit;
      padding: 0;
      margin: 0;
      border: none;
      resize: none;
      overflow: hidden;
      min-height: 1.5em;
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

  @query('tag-autocomplete-dropdown')
  private autocomplete?: TagAutocompleteDropdown;

  @query('.entry-detail-title')
  private titleInput?: HTMLTextAreaElement;

  // Tag autocomplete controller - consolidates duplicate autocomplete logic
  private autocompleteController = new TagAutocompleteController(this, {
    getInputElement: () => this.titleInput ?? null,
    getTagNames: () => this.detailController.getAllTags().map(t => t.name).sort(),
    getDropdown: () => this.autocomplete,
    onValueChange: (value) => {
      this.autoGrowTextarea();
      this.detailController.updateTitle(value);
    },
    asyncCursorPositioning: true
  });

  // Track entry ID to resize textarea when entry changes
  private currentEntryId: string | null = null;

  protected updated(): void {
    // Auto-resize textarea when entry changes
    const entryId = this.detailController.entry?.id ?? null;
    if (entryId !== this.currentEntryId) {
      this.currentEntryId = entryId;
      this.autoGrowTextarea();
    }
  }

  private autoGrowTextarea(): void {
    if (this.titleInput) {
      this.titleInput.style.height = 'auto';
      this.titleInput.style.height = `${this.titleInput.scrollHeight}px`;
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

  private handleTitleInput = (e: InputEvent): void => {
    this.autocompleteController.handleInput(e);
  };

  private handleTitleKeydown = (e: KeyboardEvent): void => {
    this.autocompleteController.handleKeydown(e);
  };

  private handleTagSelected = (e: CustomEvent<{ tagName: string }>): void => {
    this.autocompleteController.handleTagSelected(e.detail.tagName);
  };

  private handleDropdownClose = (): void => {
    this.autocompleteController.close();
  };

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

  private handleIpoChange = async (e: CustomEvent): Promise<void> => {
    const { ipoCategory } = e.detail;
    await this.detailController.updateIpoCategory(ipoCategory);
  };

  render() {
    // Ensure entry is loaded when store becomes available (handles page refresh)
    this.detailController.ensureLoaded();

    // Check if store is available and loaded, or if we're fetching the entry
    if (!this.storeController.store || !this.storeController.isLoaded || this.detailController.isLoading) {
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
            @menu-action=${this.handleMenuAction}
            @ipo-change=${this.handleIpoChange}>
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
              .query=${this.autocompleteController.query}
              .open=${this.autocompleteController.open}
              .anchorRect=${this.autocompleteController.anchorRect}
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
