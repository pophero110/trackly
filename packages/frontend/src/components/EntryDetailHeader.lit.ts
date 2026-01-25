import { css, html, LitElement } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { Entry } from '../models/Entry.js';
import { Entity } from '../models/Entity.js';
import { formatDate } from '../utils/helpers.js';
import { getEntityColor } from '../utils/entryHelpers.js';
import './DropdownMenuComponent.lit.js';
import type { DropdownMenuComponent, DropdownMenuItem } from './DropdownMenuComponent.lit.js';

type OpenDropdown = 'actions-menu' | 'entity-menu' | null;

/**
 * EntryDetailHeader Lit Component
 * Displays entry header with entity chip, timestamp, and menu
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

    .entry-detail-entity-time {
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

    .entry-chip-entity {
      --entity-color: #3b82f6;
      background: color-mix(in srgb, var(--entity-color) 12%, transparent);
      color: var(--entity-color);
      border: 1px solid color-mix(in srgb, var(--entity-color) 30%, transparent);
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 600;
    }

    .entry-chip-entity:hover {
      background: color-mix(in srgb, var(--entity-color) 20%, transparent);
      border-color: color-mix(in srgb, var(--entity-color) 50%, transparent);
      transform: translateY(-1px);
      box-shadow: 0 2px 4px color-mix(in srgb, var(--entity-color) 15%, transparent);
    }

    .entry-chip-entity svg {
      margin-left: 4px;
      vertical-align: middle;
    }

    .entry-chip-entity-container {
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
  `;

  @property({ type: Object })
  entry!: Entry;

  @property({ type: Object })
  entity!: Entity;

  @property({ type: Array })
  allEntities: Entity[] = [];

  @state()
  private openDropdown: OpenDropdown = null;

  @query('dropdown-menu[data-menu-type="actions"]')
  private actionsMenu?: DropdownMenuComponent;

  @query('dropdown-menu[data-menu-type="entity"]')
  private entityMenu?: DropdownMenuComponent;

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

  private get entityMenuItems(): DropdownMenuItem[] {
    return this.allEntities.map(entity => ({
      id: entity.id,
      label: entity.name,
      color: getEntityColor(entity.name),
      data: entity
    }));
  }

  private handleMenuButtonClick = (e: MouseEvent): void => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const menuButton = target.closest('.entry-menu-btn') as HTMLElement;

    if (!this.actionsMenu || !menuButton) return;

    // Close entity menu if open
    if (this.openDropdown === 'entity-menu') {
      this.entityMenu?.close();
    }

    this.openDropdown = 'actions-menu';
    const rect = menuButton.getBoundingClientRect();
    this.actionsMenu.openAt(rect.right, rect.bottom + 4);
  };

  private handleEntityChipClick = (e: MouseEvent): void => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const entityChip = target.closest('.entry-chip-entity') as HTMLElement;

    if (!this.entityMenu || !entityChip) return;

    // Close actions menu if open
    if (this.openDropdown === 'actions-menu') {
      this.actionsMenu?.close();
    }

    this.openDropdown = 'entity-menu';
    const rect = entityChip.getBoundingClientRect();
    this.entityMenu.openAt(rect.left, rect.bottom + 4);
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

  private handleEntityMenuAction = (e: CustomEvent): void => {
    e.stopPropagation(); // Prevent original event from bubbling further
    const { data } = e.detail;
    const entity = data as Entity;

    // Dispatch custom event for parent to handle
    this.dispatchEvent(new CustomEvent('entity-change', {
      detail: { entityId: entity.id, entityName: entity.name },
      bubbles: true,
      composed: true
    }));
  };

  private handleActionsMenuClose = (): void => {
    if (this.openDropdown === 'actions-menu') {
      this.openDropdown = null;
    }
  };

  private handleEntityMenuClose = (): void => {
    if (this.openDropdown === 'entity-menu') {
      this.openDropdown = null;
    }
  };

  render() {
    const entityColor = getEntityColor(this.entity.name);
    const formattedDate = formatDate(this.entry.timestamp);

    return html`
      <div class="entry-detail-entity-time">
        <div class="entry-chip-entity-container">
          <span
            class="entry-chip entry-chip-entity"
            style="--entity-color: ${entityColor}"
            @click=${this.handleEntityChipClick}>
            ${this.entity.name}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </div>
        <span class="entry-detail-timestamp">${formattedDate}</span>
      </div>

      <button class="entry-menu-btn" @click=${this.handleMenuButtonClick}>⋮</button>

      <!-- Actions Menu (Copy, Archive, Delete) -->
      <dropdown-menu
        data-menu-type="actions"
        .items=${this.actionsMenuItems}
        .menuId=${'entry-detail-actions-menu'}
        @menu-action=${this.handleActionsMenuAction}
        @menu-close=${this.handleActionsMenuClose}>
      </dropdown-menu>

      <!-- Entity Selector Menu -->
      <dropdown-menu
        data-menu-type="entity"
        .items=${this.entityMenuItems}
        .menuId=${'entry-detail-entity-menu'}
        @menu-action=${this.handleEntityMenuAction}
        @menu-close=${this.handleEntityMenuClose}>
      </dropdown-menu>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entry-detail-header': EntryDetailHeader;
  }
}
