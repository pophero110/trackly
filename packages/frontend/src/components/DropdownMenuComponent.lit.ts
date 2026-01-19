import { html, LitElement } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: string; // Phosphor icon class (e.g., "ph-duotone ph-trash")
  danger?: boolean; // Red/danger styling
  separator?: boolean; // Show separator after this item
  color?: string; // Custom color indicator (e.g., entity color)
  data?: any; // Additional data to pass with the item
}

/**
 * DropdownMenuComponent - Reusable context menu/dropdown menu
 * Handles positioning, open/close state, and click-outside behavior
 */
@customElement('dropdown-menu')
export class DropdownMenuComponent extends LitElement {
  @property({ type: Array })
  items: DropdownMenuItem[] = [];

  @property({ type: Boolean })
  open: boolean = false;

  @property({ type: Object })
  position: { x: number; y: number } = { x: 0, y: 0 };

  @property({ type: String })
  menuId: string = '';

  @query('.dropdown-menu-container')
  private menuContainer?: HTMLElement;

  private documentClickHandler?: (e: Event) => void;

  // Use Light DOM for compatibility with existing global styles
  createRenderRoot() {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.detachDocumentListener();
  }

  private attachDocumentListener(): void {
    // Add listener on next tick to avoid closing immediately
    setTimeout(() => {
      this.documentClickHandler = (e: Event) => {
        if (!this.open) return;

        const target = e.target as HTMLElement;

        // Don't close if clicking inside the dropdown menu itself
        if (target.closest('.dropdown-menu-container') === this.menuContainer) {
          return;
        }

        // Close menu if clicked outside
        this.close();
      };
      document.addEventListener('click', this.documentClickHandler, true);
    }, 0);
  }

  private detachDocumentListener(): void {
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler, true);
      this.documentClickHandler = undefined;
    }
  }

  /**
   * Open menu at specific position
   */
  openAt(x: number, y: number): void {
    this.position = { x, y };
    this.open = true;
    this.requestUpdate();

    // Attach click-outside listener when menu opens
    this.attachDocumentListener();

    // Adjust position after render
    requestAnimationFrame(() => this.adjustPosition());
  }

  /**
   * Close menu
   */
  close(): void {
    if (this.open) {
      this.open = false;
      this.detachDocumentListener();
      this.dispatchEvent(new CustomEvent('menu-close', { bubbles: true, composed: true }));
    }
  }

  /**
   * Toggle menu open/close
   */
  toggle(x?: number, y?: number): void {
    if (this.open) {
      this.close();
    } else if (x !== undefined && y !== undefined) {
      this.openAt(x, y);
    }
  }

  /**
   * Adjust menu position to stay within viewport
   * Position menu toward center of screen from origin point
   */
  private adjustPosition(): void {
    if (!this.menuContainer || !this.open) return;

    const menuWidth = this.menuContainer.offsetWidth;
    const menuHeight = this.menuContainer.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;

    let { x, y } = this.position;

    // Determine which side of screen the origin is on
    const isLeftSide = x < centerX;
    const isTopSide = y < centerY;

    // Position horizontally toward center
    if (isLeftSide) {
      // Origin on left side - menu extends right toward center
      // (default behavior, x is already left edge)
    } else {
      // Origin on right side - menu extends left toward center
      x = x - menuWidth;
    }

    // Position vertically toward center
    if (isTopSide) {
      // Origin on top side - menu extends down toward center
      // (default behavior, y is already top edge)
    } else {
      // Origin on bottom side - menu extends up toward center
      y = y - menuHeight;
    }

    // Ensure menu stays within viewport with padding
    const padding = 8;
    x = Math.max(padding, Math.min(x, viewportWidth - menuWidth - padding));
    y = Math.max(padding, Math.min(y, viewportHeight - menuHeight - padding));

    this.menuContainer.style.left = `${x}px`;
    this.menuContainer.style.top = `${y}px`;
  }

  private handleItemClick(e: MouseEvent, item: DropdownMenuItem): void {
    e.stopPropagation();

    // Dispatch custom event with item id and data
    this.dispatchEvent(new CustomEvent('menu-action', {
      detail: { action: item.id, data: item.data },
      bubbles: true,
      composed: true
    }));

    // Close menu after action
    this.close();
  }

  updated(changedProperties: Map<string, unknown>): void {
    super.updated(changedProperties);

    if (changedProperties.has('open') && this.open) {
      this.adjustPosition();
    }
  }

  render() {
    if (!this.open || this.items.length === 0) {
      return html``;
    }

    return html`
      <div
        class="dropdown-menu-container context-menu"
        style="display: block; position: fixed; left: ${this.position.x}px; top: ${this.position.y}px;"
        @click=${(e: MouseEvent) => e.stopPropagation()}>
        ${map(this.items, item => html`
          <div
            class="context-menu-item ${item.danger ? 'danger' : ''} ${item.color ? 'entity-dropdown-item' : ''}"
            @click=${(e: MouseEvent) => this.handleItemClick(e, item)}>
            ${item.color ? html`<span class="entity-dropdown-color" style="background: ${item.color};"></span>` : ''}
            ${item.icon ? html`<i class="${item.icon}"></i>` : ''}
            <span>${item.label}</span>
          </div>
        `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dropdown-menu': DropdownMenuComponent;
  }
}
