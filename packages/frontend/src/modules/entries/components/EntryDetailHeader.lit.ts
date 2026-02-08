import { css, html, LitElement } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { Entry } from '../models/Entry.js';
import { Tag } from '../../tags/models/Tag.js';
import { IEntryTag, IpoCategory } from '../../../types/index.js';
import { formatDate } from '../../../core/utils/helpers.js';
import { getTagColor } from '../utils/entryHelpers.js';
import '../../../ui-kit/navigation/DropdownMenuComponent.lit.js';
import type { DropdownMenuComponent, DropdownMenuItem } from '../../../ui-kit/navigation/DropdownMenuComponent.lit.js';

// IPO category configuration (shared with EntryListItem)
const IPO_CONFIG = {
  input: { icon: '↓', label: 'In', color: '#3B82F6' },
  process: { icon: '⚙', label: 'Pro', color: '#F59E0B' },
  output: { icon: '↑', label: 'Out', color: '#10B981' }
} as const;

type OpenDropdown = 'actions-menu' | 'tag-menu' | 'ipo-menu' | null;

/**
 * EntryDetailHeader Lit Component
 * Displays entry header with tag chip, timestamp, and menu
 */
@customElement('entry-detail-header')
export class EntryDetailHeader extends LitElement {
  static styles = css`
    :host {
      flex-shrink: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .entry-detail-tag-time {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .entry-detail-timestamp {
      font-size: 0.8125rem;
      color: var(--text-muted);
      font-weight: 400;
      line-height: 1.4;
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

    .entry-chip-tag svg {
      margin-left: 4px;
      vertical-align: middle;
    }

    .entry-chip-tag-container {
      display: inline-block;
      position: relative;
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

    .entry-chip-ipo-container {
      display: inline-block;
      position: relative;
      margin-left: auto;
      margin-right: 8px;
    }

    .entry-chip-ipo {
      --ipo-color: #6B7280;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1.4;
      background: color-mix(in srgb, var(--ipo-color) 12%, transparent);
      color: var(--ipo-color);
      border: 1px solid color-mix(in srgb, var(--ipo-color) 30%, transparent);
      cursor: pointer;
      transition: all 0.2s;
    }

    .entry-chip-ipo:hover {
      background: color-mix(in srgb, var(--ipo-color) 20%, transparent);
      border-color: color-mix(in srgb, var(--ipo-color) 50%, transparent);
      transform: translateY(-1px);
      box-shadow: 0 2px 4px color-mix(in srgb, var(--ipo-color) 15%, transparent);
    }

    .entry-chip-ipo svg {
      margin-left: 4px;
      vertical-align: middle;
    }

    .entry-chip-ipo .ipo-icon {
      font-size: 0.8rem;
    }
  `;

  @property({ type: Object })
  entry!: Entry;

  @property({ type: Array })
  entryTags: IEntryTag[] = [];

  @property({ type: Array })
  allTags: Tag[] = [];

  @state()
  private openDropdown: OpenDropdown = null;

  @query('dropdown-menu[data-menu-type="actions"]')
  private actionsMenu?: DropdownMenuComponent;

  @query('dropdown-menu[data-menu-type="tag"]')
  private tagMenu?: DropdownMenuComponent;

  @query('dropdown-menu[data-menu-type="ipo"]')
  private ipoMenu?: DropdownMenuComponent;

  private get actionsMenuItems(): DropdownMenuItem[] {
    return [
      {
        id: 'copy',
        label: 'Copy Notes',
        icon: 'ph-duotone ph-copy'
      },
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
    return this.allTags.map(tag => ({
      id: tag.id,
      label: tag.name,
      color: getTagColor(tag.name),
      data: tag
    }));
  }

  private get ipoMenuItems(): DropdownMenuItem[] {
    return [
      {
        id: 'input',
        label: `${IPO_CONFIG.input.icon} Input`,
        color: IPO_CONFIG.input.color,
        data: 'input'
      },
      {
        id: 'process',
        label: `${IPO_CONFIG.process.icon} Process`,
        color: IPO_CONFIG.process.color,
        data: 'process'
      },
      {
        id: 'output',
        label: `${IPO_CONFIG.output.icon} Output`,
        color: IPO_CONFIG.output.color,
        data: 'output'
      }
    ];
  }

  private handleMenuButtonClick = (e: MouseEvent): void => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const menuButton = target.closest('.entry-menu-btn') as HTMLElement;

    if (!this.actionsMenu || !menuButton) return;

    // Close tag menu if open
    if (this.openDropdown === 'tag-menu') {
      this.tagMenu?.close();
    }

    this.openDropdown = 'actions-menu';
    const rect = menuButton.getBoundingClientRect();
    this.actionsMenu.openAt(rect.right, rect.bottom + 4);
  };

  private handleTagChipClick = (e: MouseEvent): void => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const tagChip = target.closest('.entry-chip-tag') as HTMLElement;

    if (!this.tagMenu || !tagChip) return;

    // Close actions menu if open
    if (this.openDropdown === 'actions-menu') {
      this.actionsMenu?.close();
    }

    this.openDropdown = 'tag-menu';
    const rect = tagChip.getBoundingClientRect();
    this.tagMenu.openAt(rect.left, rect.bottom + 4);
  };

  private handleActionsMenuAction = (e: CustomEvent): void => {
    e.stopPropagation(); // Prevent original event from bubbling further
    const { action } = e.detail;

    // Dispatch custom event for parent to handle
    this.dispatchEvent(new CustomEvent('menu-action', {
      detail: { action },
      bubbles: true,
      composed: true
    }));
  };

  private handleTagMenuAction = (e: CustomEvent): void => {
    e.stopPropagation(); // Prevent original event from bubbling further
    const { data } = e.detail;
    const tag = data as Tag;

    // Dispatch custom event for parent to handle
    this.dispatchEvent(new CustomEvent('tag-change', {
      detail: { tagId: tag.id, tagName: tag.name },
      bubbles: true,
      composed: true
    }));
  };

  private handleActionsMenuClose = (): void => {
    if (this.openDropdown === 'actions-menu') {
      this.openDropdown = null;
    }
  };

  private handleTagMenuClose = (): void => {
    if (this.openDropdown === 'tag-menu') {
      this.openDropdown = null;
    }
  };

  private handleIpoChipClick = (e: MouseEvent): void => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const ipoChip = target.closest('.entry-chip-ipo-container') as HTMLElement;

    if (!this.ipoMenu || !ipoChip) return;

    // Close other menus if open
    if (this.openDropdown === 'actions-menu') {
      this.actionsMenu?.close();
    }
    if (this.openDropdown === 'tag-menu') {
      this.tagMenu?.close();
    }

    this.openDropdown = 'ipo-menu';
    const rect = ipoChip.getBoundingClientRect();
    this.ipoMenu.openAt(rect.left, rect.bottom + 4);
  };

  private handleIpoMenuAction = (e: CustomEvent): void => {
    e.stopPropagation();
    const { data } = e.detail;
    const newCategory = data as IpoCategory;

    this.dispatchEvent(new CustomEvent('ipo-change', {
      detail: { ipoCategory: newCategory },
      bubbles: true,
      composed: true
    }));
  };

  private handleIpoMenuClose = (): void => {
    if (this.openDropdown === 'ipo-menu') {
      this.openDropdown = null;
    }
  };

  render() {
    const formattedDate = formatDate(this.entry.timestamp);
    const primaryTag = this.entryTags[0];
    const primaryTagColor = primaryTag ? getTagColor(primaryTag.tagName) : '';
    const currentIpo = this.entry.ipoCategory;

    return html`
      <div class="entry-detail-tag-time">
        ${primaryTag ? html`
          <div class="entry-chip-tag-container">
            <span
              class="entry-chip entry-chip-tag"
              style="--tag-color: ${primaryTagColor}"
              @click=${this.handleTagChipClick}>
              ${primaryTag.tagName}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          </div>
        ` : null}
        ${map(this.entryTags.slice(1), entryTag => html`
          <span
            class="entry-chip entry-chip-tag"
            style="--tag-color: ${getTagColor(entryTag.tagName)}">
            ${entryTag.tagName}
          </span>
        `)}
        <span class="entry-detail-timestamp">${formattedDate}</span>
      </div>

      ${when(currentIpo, () => {
        const ipoConfig = IPO_CONFIG[currentIpo!];
        return html`
          <div class="entry-chip-ipo-container">
            <span
              class="entry-chip-ipo"
              style="--ipo-color: ${ipoConfig.color}"
              @click=${this.handleIpoChipClick}>
              <span class="ipo-icon">${ipoConfig.icon}</span>
              ${ipoConfig.label}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          </div>
        `;
      })}

      <button class="entry-menu-btn" @click=${this.handleMenuButtonClick}>⋮</button>

      <!-- Actions Menu (Copy, Archive, Delete) -->
      <dropdown-menu
        data-menu-type="actions"
        .items=${this.actionsMenuItems}
        .menuId=${'entry-detail-actions-menu'}
        @menu-action=${this.handleActionsMenuAction}
        @menu-close=${this.handleActionsMenuClose}>
      </dropdown-menu>

      <!-- Tag Selector Menu -->
      <dropdown-menu
        data-menu-type="tag"
        .items=${this.tagMenuItems}
        .menuId=${'entry-detail-tag-menu'}
        @menu-action=${this.handleTagMenuAction}
        @menu-close=${this.handleTagMenuClose}>
      </dropdown-menu>

      <!-- IPO Category Menu -->
      <dropdown-menu
        data-menu-type="ipo"
        .items=${this.ipoMenuItems}
        .menuId=${'entry-detail-ipo-menu'}
        @menu-action=${this.handleIpoMenuAction}
        @menu-close=${this.handleIpoMenuClose}>
      </dropdown-menu>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entry-detail-header': EntryDetailHeader;
  }
}
