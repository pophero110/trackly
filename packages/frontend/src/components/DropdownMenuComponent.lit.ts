import { html, css, LitElement } from 'lit';
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
  static styles = css`
    :host {
      display: contents;
    }

    .dropdown-menu-container {
      position: fixed;
      background: var(--background, #F9FAFB);
      border: none;
      border-radius: var(--radius-sm, 8px);
      box-shadow: var(--shadow-lg, 0 20px 25px -5px rgba(0, 0, 0, 0.08));
      padding: 0;
      min-width: 150px;
      z-index: 10000;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      user-select: none;
    }

    .menu-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary, #6B7280);
      cursor: pointer;
      transition: all 0.2s;
      user-select: none;
    }

    .menu-item:hover {
      background: var(--background, #F9FAFB);
      color: var(--text-primary, #111827);
    }

    .menu-item.danger {
      color: #ef4444;
    }

    .menu-item.danger:hover {
      background: #fee2e2;
      color: #dc2626;
    }

    .entity-color {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    @media (prefers-color-scheme: dark) {
      .dropdown-menu-container {
        background: var(--background, #1F2937);
      }

      .menu-item {
        color: var(--text-secondary, #D1D5DB);
      }

      .menu-item:hover {
        background: var(--background-secondary, #374151);
        color: var(--text-primary, #F9FAFB);
      }
    }
  `;

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
  private documentScrollHandler?: (e: Event) => void;

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.detachDocumentListener();
    this.detachScrollListener();
  }

  private attachDocumentListener(): void {
    // Add listener on next tick to avoid closing immediately
    setTimeout(() => {
      this.documentClickHandler = (e: Event) => {
        if (!this.open) return;

        const target = e.target as Node;

        // Don't close if clicking inside the dropdown menu itself
        // Check if click target is the menuContainer or inside it
        if (target === this.menuContainer || this.menuContainer?.contains(target)) {
          return;
        }

        // Don't close if clicking inside the shadow root
        if (this.shadowRoot && this.shadowRoot.contains(target)) {
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

  private attachScrollListener(): void {
    this.documentScrollHandler = (e: Event) => {
      if (!this.open) return;

      const target = e.target as Node;

      // Don't close if scrolling inside the dropdown menu itself
      // Check if scroll target is the menuContainer or inside it
      if (target === this.menuContainer || this.menuContainer?.contains(target)) {
        return;
      }

      // Don't close if scrolling inside the shadow root
      if (this.shadowRoot && this.shadowRoot.contains(target)) {
        return;
      }

      // Close menu if scrolling outside
      this.close();
    };
    document.addEventListener('scroll', this.documentScrollHandler, true);
  }

  private detachScrollListener(): void {
    if (this.documentScrollHandler) {
      document.removeEventListener('scroll', this.documentScrollHandler, true);
      this.documentScrollHandler = undefined;
    }
  }

  /**
   * Open menu at specific position
   */
  openAt(x: number, y: number): void {
    this.position = { x, y };
    this.open = true;
    this.requestUpdate();

    // Attach click-outside and scroll listeners when menu opens
    this.attachDocumentListener();
    this.attachScrollListener();

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
      this.detachScrollListener();
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
    const maxHeight = 400; // Match max-height in render
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;

    let { x, y } = this.position;

    // Use actual menu height, but cap at maxHeight
    const effectiveHeight = Math.min(menuHeight, maxHeight);

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
      y = y - effectiveHeight;
    }

    // Ensure menu stays within viewport with padding
    const padding = 8;
    x = Math.max(padding, Math.min(x, viewportWidth - menuWidth - padding));
    y = Math.max(padding, Math.min(y, viewportHeight - effectiveHeight - padding));

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
        class="dropdown-menu-container"
        style="left: ${this.position.x}px; top: ${this.position.y}px; max-height: 400px; overflow-y: auto;"
        @click=${(e: MouseEvent) => e.stopPropagation()}>
        ${map(this.items, item => html`
          <div
            class="menu-item ${item.danger ? 'danger' : ''}"
            @click=${(e: MouseEvent) => this.handleItemClick(e, item)}>
            ${item.color ? html`<span class="entity-color" style="background: ${item.color};"></span>` : ''}
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
