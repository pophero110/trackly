import { html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import './DropdownMenuComponent.lit.js';
import type { DropdownMenuComponent, DropdownMenuItem } from './DropdownMenuComponent.lit.js';

/**
 * DropdownMenuButton - A button that opens a dropdown menu
 * Combines a trigger button with a dropdown menu component
 */
@customElement('dropdown-menu-button')
export class DropdownMenuButton extends LitElement {
  @property({ type: Array })
  items: DropdownMenuItem[] = [];

  @property({ type: String })
  icon: string = '⋮';

  @property({ type: String })
  buttonClass: string = 'entry-menu-btn';

  @property({ type: String })
  menuId: string = '';

  @query('dropdown-menu')
  private dropdownMenu?: DropdownMenuComponent;

  // Disable Shadow DOM for compatibility with existing global styles
  createRenderRoot() {
    return this;
  }

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
        class="${this.buttonClass}"
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
