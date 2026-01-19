import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { Entry } from '../models/Entry.js';
import { Entity } from '../models/Entity.js';
import { escapeHtml, formatDate } from '../utils/helpers.js';
import { getEntityColor } from '../utils/entryHelpers.js';
import { URLStateManager } from '../utils/urlState.js';

/**
 * EntryDetailHeader Lit Component
 * Displays entry header with entity chip, timestamp, and menu
 */
@customElement('entry-detail-header')
export class EntryDetailHeader extends LitElement {
  @property({ type: Object })
  entry!: Entry;

  @property({ type: Object })
  entity!: Entity;

  @property({ type: Array })
  allEntities: Entity[] = [];

  @state()
  private menuOpen: boolean = false;

  @state()
  private entityDropdownOpen: boolean = false;

  // Disable Shadow DOM for compatibility with existing global styles
  createRenderRoot() {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('click', this.handleDocumentClick);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this.handleDocumentClick);
  }

  private handleDocumentClick = (e: Event): void => {
    const target = e.target as HTMLElement;
    if (!target.closest('.entry-detail-menu') && !target.closest('.entry-detail-menu-btn')) {
      this.menuOpen = false;
    }
    if (!target.closest('.entity-dropdown-menu') && !target.closest('.entry-chip-entity')) {
      this.entityDropdownOpen = false;
    }
  };

  private handleMenuToggle = (e: Event): void => {
    e.stopPropagation();
    this.menuOpen = !this.menuOpen;
  };

  private handleEntityChipClick = (e: Event): void => {
    e.stopPropagation();
    this.entityDropdownOpen = !this.entityDropdownOpen;
  };

  private handleEntityChange = (e: Event, entity: Entity): void => {
    e.stopPropagation();
    this.entityDropdownOpen = false;

    // Dispatch custom event for parent to handle
    this.dispatchEvent(new CustomEvent('entity-change', {
      detail: { entityId: entity.id, entityName: entity.name },
      bubbles: true,
      composed: true
    }));
  };

  private handleMenuAction = (e: Event, action: string): void => {
    e.stopPropagation();
    this.menuOpen = false;

    // Dispatch custom event for parent to handle
    this.dispatchEvent(new CustomEvent('menu-action', {
      detail: { action },
      bubbles: true,
      composed: true
    }));
  };

  private handleClose = (): void => {
    URLStateManager.goBack();
  };

  render() {
    const entityColor = getEntityColor(this.entity.name);
    const formattedDate = formatDate(this.entry.timestamp);

    return html`
          <div class="entry-detail-entity-time">
            <div class="entry-chip-entity-container" style="position: relative;">
              <span
                class="entry-chip entry-chip-entity"
                style="--entity-color: ${entityColor}; cursor: pointer;"
                @click=${this.handleEntityChipClick}>
                ${escapeHtml(this.entity.name)}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 4px;">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </span>
              ${when(
      this.entityDropdownOpen,
      () => html`
                  <div class="entity-dropdown-menu" style="display: block;">
                    ${map(this.allEntities, entity => html`
                      <div
                        class="context-menu-item entity-dropdown-item"
                        @click=${(e: Event) => this.handleEntityChange(e, entity)}>
                        <span class="entity-dropdown-color" style="background: ${getEntityColor(entity.name)};"></span>
                        ${escapeHtml(entity.name)}
                      </div>
                    `)}
                  </div>
                `
    )}
            </div>
            <span class="entry-detail-timestamp">${formattedDate}</span>
          </div>

          <div class="entry-detail-header-actions">
            <button class="entry-detail-menu-btn" @click=${this.handleMenuToggle}>⋮</button>
            <button class="entry-detail-close-btn" @click=${this.handleClose}>×</button>
          </div>

          ${when(
      this.menuOpen,
      () => html`
              <div class="entry-detail-menu" style="display: block;">
                <div class="context-menu-item" @click=${(e: Event) => this.handleMenuAction(e, 'copy')}>
                  <i class="ph-duotone ph-copy"></i>
                  <span>Copy Notes</span>
                </div>
                <div class="context-menu-item" @click=${(e: Event) => this.handleMenuAction(e, 'archive')}>
                  <i class="ph-duotone ph-archive"></i>
                  <span>Archive</span>
                </div>
                <div class="context-menu-item danger" @click=${(e: Event) => this.handleMenuAction(e, 'delete')}>
                  <i class="ph-duotone ph-trash"></i>
                  <span>Delete</span>
                </div>
              </div>
            `
    )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entry-detail-header': EntryDetailHeader;
  }
}
