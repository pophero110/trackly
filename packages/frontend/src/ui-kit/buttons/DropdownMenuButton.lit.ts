import { html, LitElement, css } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import '../navigation/DropdownMenuComponent.lit.js';
import type { DropdownMenuComponent, DropdownMenuItem } from '../navigation/DropdownMenuComponent.lit.js';

/**
 * DropdownMenuButton - A button that opens a dropdown menu
 * Combines a trigger button with a dropdown menu component
 */
@customElement('dropdown-menu-button')
export class DropdownMenuButton extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
      position: relative;
    }

    .menu-btn {
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

    .menu-btn:hover {
      color: var(--text-primary);
      background: var(--background);
    }
  `;

  @property({ type: Array })
  items: DropdownMenuItem[] = [];

  @property({ type: String })
  icon: string = '⋮';

  @property({ type: String })
  menuId: string = '';

  @query('dropdown-menu')
  private dropdownMenu?: DropdownMenuComponent;

  private handleButtonClick = (e: MouseEvent): void => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const button = target.closest('button') as HTMLElement;

    if (!this.dropdownMenu || !button) return;

    const rect = button.getBoundingClientRect();
    this.dropdownMenu.openAt(rect.right, rect.bottom + 4);
  };

  private handleMenuAction = (e: CustomEvent): void => {
    // Re-dispatch the event from dropdown-menu
    this.dispatchEvent(new CustomEvent('menu-action', {
      detail: e.detail,
      bubbles: true,
      composed: true
    }));
  };

  private handleMenuClose = (): void => {
    this.dispatchEvent(new CustomEvent('menu-close', {
      bubbles: true,
      composed: true
    }));
  };

  /** Close the dropdown menu programmatically */
  close(): void {
    this.dropdownMenu?.close();
  }

  render() {
    return html`
      <button
        class="menu-btn"
        @click=${this.handleButtonClick}>
        ${this.icon}
      </button>
      <dropdown-menu
        .items=${this.items}
        .menuId=${this.menuId}
        @menu-action=${this.handleMenuAction}
        @menu-close=${this.handleMenuClose}>
      </dropdown-menu>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dropdown-menu-button': DropdownMenuButton;
  }
}
