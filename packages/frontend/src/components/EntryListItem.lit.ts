import { html, LitElement, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { Entry } from '../models/Entry.js';
import { Tag } from '../models/Tag.js';
import { extractHashtags, getTagColor } from '../utils/entryHelpers.js';
import { URLStateManager } from '../utils/urlState.js';
import { Store } from '../state/Store.js';
import { storeRegistry } from '../state/StoreRegistry.js';
import { toast } from '../utils/toast.js';
import './DropdownMenuComponent.lit.js';
import type { DropdownMenuComponent, DropdownMenuItem } from './DropdownMenuComponent.lit.js';

type OpenDropdown = 'context-menu' | 'tag-menu' | null;

/**
 * EntryListItem Lit Component
 * Displays a single entry card with all its details
 */
@customElement('entry-list-item')
export class EntryListItem extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .timeline-entry-card {
      background: transparent;
      border: 1px solid var(--border-light);
      border-radius: var(--radius-lg);
      padding: var(--base-size-16);
      box-shadow: var(--shadow-ambient);
      transition: all 0.2s ease;
      cursor: pointer;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    .timeline-entry-card:hover {
      border-color: var(--primary);
    }

    .timeline-entry-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 12px;
    }

    .timeline-entry-primary {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      min-width: 0;
    }

    .timeline-entry-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1.4;
      margin: 0.5em 0 0.25em 0;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    .timeline-entry-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 12px;
    }

    .timeline-entry-tag {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      background: var(--background);
      border-radius: 12px;
      font-size: 0.75rem;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s;
      opacity: 0.7;
    }

    .timeline-entry-tag:hover {
      background: var(--primary);
      color: white;
      opacity: 1;
    }

    .entry-chip {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
      line-height: 1.4;
    }

    .entry-chip-tag {
      --tag-color: #3b82f6;
      background: color-mix(in srgb, var(--tag-color) 12%, transparent);
      color: var(--tag-color);
      border: 1px solid color-mix(in srgb, var(--tag-color) 30%, transparent);
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 600;
    }

    .entry-chip-tag:hover {
      background: color-mix(in srgb, var(--tag-color) 20%, transparent);
      border-color: color-mix(in srgb, var(--tag-color) 50%, transparent);
      transform: translateY(-1px);
      box-shadow: 0 2px 4px color-mix(in srgb, var(--tag-color) 15%, transparent);
    }

    .entry-chip-tag-container {
      display: inline-block;
      position: relative;
    }

    .entry-chip-tag svg {
      margin-left: 4px;
      vertical-align: middle;
    }

    .entry-menu-btn {
      background: none;
      border: none;
      border-radius: 4px;
      color: var(--text-muted);
      font-size: 1.25rem;
      cursor: pointer;
      padding: 2px 6px;
      line-height: 1;
      transition: all 0.2s;
      opacity: 1;
    }

    .entry-menu-btn:hover {
      color: var(--text-primary);
      background: var(--background);
    }

    /* Responsive styles */
    @media (max-width: 768px) {
      .timeline-entry-header {
        gap: 8px;
      }

      .timeline-entry-primary {
        gap: 8px;
        flex-wrap: wrap;
      }
    }

    @media (max-width: 480px) {
      .timeline-entry-card:hover {
        transform: none;
      }

      .timeline-entry-primary {
        width: 100%;
        gap: 6px;
      }

      .timeline-entry-tags {
        gap: 4px;
        margin-top: 8px;
      }

      .entry-chip {
        font-size: 0.75rem;
        padding: 3px 8px;
      }
    }

    .ipo-badge {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 0.65rem;
      font-weight: 600;
      line-height: 1;
    }

    .ipo-badge.input {
      background: rgba(59, 130, 246, 0.15);
      color: #3B82F6;
    }

    .ipo-badge.process {
      background: rgba(245, 158, 11, 0.15);
      color: #F59E0B;
    }

    .ipo-badge.output {
      background: rgba(16, 185, 129, 0.15);
      color: #10B981;
    }

    .ipo-badge .ipo-icon {
      font-size: 0.7rem;
    }
  `;

  @property({ type: Object })
  entry!: Entry;

  @state()
  private openDropdown: OpenDropdown = null;

  @query('dropdown-menu[data-menu-type="context"]')
  private contextMenu?: DropdownMenuComponent;

  @query('dropdown-menu[data-menu-type="tag"]')
  private tagMenu?: DropdownMenuComponent;

  private store!: Store;

  private get contextMenuItems(): DropdownMenuItem[] {
    return [
      {
        id: 'archive',
        label: 'Archive',
        icon: 'ph-duotone ph-archive'
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: 'ph-duotone ph-trash',
        danger: true
      }
    ];
  }

  private get tagMenuItems(): DropdownMenuItem[] {
    const allTags = this.store?.getTags() || [];
    return allTags.map(tag => ({
      id: tag.id,
      label: tag.name,
      color: getTagColor(tag.name),
      data: tag
    }));
  }

  connectedCallback(): void {
    super.connectedCallback();
    try {
      this.store = storeRegistry.getStore();
    } catch (e) {
      console.warn('EntryListItem: Store not yet initialized');
    }
  }

  private handleCardClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-action="menu"], a, .timeline-entry-tag, .entry-chip-tag-container')) {
      return;
    }
    URLStateManager.showEntryDetail(this.entry.id);
  };

  private handleMenuButtonClick = (e: MouseEvent) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const menuButton = target.closest('[data-action="menu"]') as HTMLElement;

    if (!this.contextMenu || !menuButton) return;

    // Close tag menu if open
    if (this.openDropdown === 'tag-menu') {
      this.tagMenu?.close();
    }

    this.openDropdown = 'context-menu';
    const rect = menuButton.getBoundingClientRect();
    this.contextMenu.openAt(rect.right, rect.bottom + 4);
  };

  private handleContextMenuAction = (e: CustomEvent) => {
    e.stopPropagation();
    const { action } = e.detail;

    if (action === 'archive') {
      this.handleArchive();
    } else if (action === 'delete') {
      this.handleDelete();
    }
  };

  private handleTagClick = (e: MouseEvent, tag: string) => {
    e.stopPropagation();
    URLStateManager.addTagFilter(tag);
  };

  private handleTagChipClick = (e: MouseEvent) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const tagChip = target.closest('.entry-chip-tag-container') as HTMLElement;

    if (!this.tagMenu || !tagChip) return;

    // Close context menu if open
    if (this.openDropdown === 'context-menu') {
      this.contextMenu?.close();
    }

    this.openDropdown = 'tag-menu';
    const rect = tagChip.getBoundingClientRect();
    this.tagMenu.openAt(rect.left, rect.bottom + 4);
  };

  private handleTagMenuAction = (e: CustomEvent) => {
    e.stopPropagation();
    const { data } = e.detail;
    if (data) {
      this.handleTagChange(data as Tag);
    }
  };

  private handleContextMenuClose = () => {
    if (this.openDropdown === 'context-menu') {
      this.openDropdown = null;
    }
  };

  private handleTagMenuClose = () => {
    if (this.openDropdown === 'tag-menu') {
      this.openDropdown = null;
    }
  };

  private async handleTagChange(newTag: Tag) {
    if (!this.store) {
      console.error('Store not available');
      return;
    }

    const oldTags = [...this.entry.tags];

    // Optimistic update - replace all tags with the new one
    this.entry = new Entry({
      ...this.entry,
      tags: [{
        id: `temp-${Date.now()}`,
        tagId: newTag.id,
        tagName: newTag.name,
        createdAt: new Date().toISOString()
      }]
    });
    this.requestUpdate();

    try {
      await this.store.updateEntry(this.entry.id, {
        tagIds: [newTag.id]
      });
    } catch (error) {
      console.error('Error updating entry tag:', error);
      // Rollback on error
      this.entry = new Entry({
        ...this.entry,
        tags: oldTags
      });
      this.requestUpdate();
    }
  };

  private handleDelete(): void {
    if (!this.store) {
      console.error('Store not available');
      return;
    }

    const entry = this.entry;
    const store = this.store;

    toast.show({
      message: 'Entry deleted',
      type: 'success',
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: async () => {
          try {
            await store.addEntry(entry);
            toast.success('Entry restored');
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            toast.error(`Failed to restore entry: ${message}`);
          }
        }
      }
    });

    store.deleteEntry(this.entry.id).catch((error) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error deleting entry: ${message}`);
    });
  }

  private async handleArchive(): Promise<void> {
    if (!this.store) {
      console.error('Store not available');
      return;
    }

    // Show success toast immediately (optimistic update)
    toast.success('Entry archived successfully');

    try {
      await this.store.archiveEntry(this.entry.id, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error archiving entry: ${message}`);
    }
  }

  render() {
    // Get the first tag for the dropdown (primary tag)
    const primaryEntryTag = this.entry.primaryTag;
    const primaryTag = primaryEntryTag ? this.store?.getTagById(primaryEntryTag.tagId) : undefined;

    // Tag chip with dropdown
    const tagColor = primaryTag ? getTagColor(primaryTag.name) : '';

    // Extract hashtags from title and notes
    const titleTags = this.entry.title ? extractHashtags(this.entry.title) : [];
    const notesTags = this.entry.notes ? extractHashtags(this.entry.notes) : [];
    const hashtags = [...new Set([...titleTags, ...notesTags])];

    return html`
        <div class="timeline-entry-card" @click=${this.handleCardClick}>
          <div class="timeline-entry-header">
            <div class="timeline-entry-primary">
              ${when(primaryTag, () => html`
                <div class="entry-chip-tag-container" data-entry-id="${this.entry.id}">
                  <span
                    class="entry-chip entry-chip-tag"
                    data-tag-id="${primaryTag!.id}"
                    data-tag-name="${primaryTag!.name}"
                    style="--tag-color: ${tagColor}"
                    @click=${this.handleTagChipClick}>
                    ${primaryTag!.name}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </span>
                </div>
              `)}
              ${map(this.entry.tags.slice(1), entryTag => {
                const tag = this.store?.getTagById(entryTag.tagId);
                return tag ? html`
                  <span
                    class="entry-chip entry-chip-tag"
                    style="--tag-color: ${getTagColor(tag.name)}">
                    ${tag.name}
                  </span>
                ` : null;
              })}
              ${when(this.entry.ipoCategory, () => html`
                <span class="ipo-badge ${this.entry.ipoCategory}">
                  <span class="ipo-icon">${this.entry.ipoCategory === 'input' ? '↓' : this.entry.ipoCategory === 'process' ? '⚙' : '↑'}</span>
                  ${this.entry.ipoCategory === 'input' ? 'In' : this.entry.ipoCategory === 'process' ? 'Pro' : 'Out'}
                </span>
              `)}
            </div>
            <button
              class="entry-menu-btn"
              data-entry-id="${this.entry.id}"
              data-action="menu"
              @click=${this.handleMenuButtonClick}>
              ⋮
            </button>
          </div>

          ${when(this.entry.title, () => html`
            <div class="timeline-entry-title">${this.entry.title}</div>
          `)}

          ${when(hashtags.length > 0, () => html`
            <div class="timeline-entry-tags">
              ${map(hashtags, tag => html`
                <span
                  class="timeline-entry-tag"
                  data-tag="${tag}"
                  @click=${(e: MouseEvent) => this.handleTagClick(e, tag)}>
                  #${tag}
                </span>
              `)}
            </div>
          `)}
        </div>


      <!-- TODO: use Event Delegation and move these dropdownMenu to EntryListComponent instead of creting dropdown menu per item-->
      <!-- Context Menu -->
      <dropdown-menu
        data-menu-type="context"
        .items=${this.contextMenuItems}
        .menuId=${'entry-menu-' + this.entry.id}
        @menu-action=${this.handleContextMenuAction}
        @menu-close=${this.handleContextMenuClose}>
      </dropdown-menu>

      <!-- Tag Selector Menu -->
      <dropdown-menu
        data-menu-type="tag"
        .items=${this.tagMenuItems}
        .menuId=${'tag-selector-' + this.entry.id}
        @menu-action=${this.handleTagMenuAction}
        @menu-close=${this.handleTagMenuClose}>
      </dropdown-menu>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entry-list-item': EntryListItem;
  }
}
