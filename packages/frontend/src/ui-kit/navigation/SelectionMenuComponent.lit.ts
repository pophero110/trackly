import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { live } from 'lit/directives/live.js';

export interface SelectionOption {
  value: string;
  label: string;
}

/**
 * SelectionMenuComponent - Reusable single-selection dropdown
 * Refactored for semantic naming and improved mobile UX.
 */
@customElement('selection-menu')
export class SelectionMenuComponent extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
      position: relative;
      font-family: var(--font-family, system-ui, -apple-system, sans-serif);
    }

    /* Backdrop for closing menu on outside click/scroll */
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 999;
      background: transparent;
      touch-action: none;
    }

    /* Trigger Button (formerly .btn-tag-filter) */
    .menu-trigger {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0px;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary, #666);
      background: transparent;
      border: none;
      border-radius: var(--radius-sm, 4px);
      cursor: pointer;
      transition: all 0.2s ease;
      outline: none;
      max-width: 300px;
      text-align: left;
    }

    .menu-trigger:hover {
      color: var(--text-primary, #000);
    }

    .menu-trigger[aria-expanded="true"] {
      color: var(--text-primary, #000);
    }

    /* Icon Slot Styling */
    ::slotted([slot="icon"]) {
      flex-shrink: 0;
      font-size: 1.1rem;
      display: flex;
      align-items: center;
    }

    /* Dropdown Menu (formerly .tag-filter-menu) */
    .dropdown-container {
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 4px;
      background: var(--background, #fff);
      border-radius: var(--radius-md, 8px);
      box-shadow: var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.1));
      min-width: 200px;
      max-height: 300px;
      overflow-y: auto;
      z-index: 1000;
      padding: 4px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      overscroll-behavior: contain;
      border: 1px solid var(--border-color, #eee);
    }

    /* Hidden state */
    :host(:not([open])) .dropdown-container {
      display: none;
    }

    /* Menu Items (formerly .tag-filter-option) */
    .menu-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      cursor: pointer;
      border-radius: var(--radius-sm, 4px);
      transition: background 0.15s ease;
      user-select: none;
    }

    .menu-item:hover {
      background: var(--bg-hover, #f5f5f5);
    }

    .menu-item input[type="radio"] {
      margin: 0;
      cursor: pointer;
      accent-color: var(--brand-primary, #007aff);
      width: 16px;
      height: 16px;
    }

    .menu-item span {
      font-size: 0.875rem;
      color: var(--text-primary, #111);
      font-weight: 500;
    }

    /* Mobile adjustments */
    @media (max-width: 480px) {
      .menu-trigger {
        min-height: 40px;
        padding: 7px 0px;
        font-size: 0.8125rem;
        max-width: 140px;
      }

      .dropdown-container {
        min-width: 220px;
        max-width: calc(100vw - 32px);
      }
    }
  `;

  @property({ type: Array }) options: SelectionOption[] = [];
  @property({ type: String }) selectedValue: string = '';
  @property({ type: String }) title: string = '';
  @property({ type: String }) clearOptionLabel: string = '';

  @state() private menuOpen: boolean = false;

  private documentClickHandler?: (e: Event) => void;
  private documentScrollHandler?: (e: Event) => void;

  connectedCallback(): void {
    super.connectedCallback();
    this.attachEventListeners();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.detachEventListeners();
  }

  protected updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('menuOpen')) {
      if (this.menuOpen) {
        this.setAttribute('open', '');
      } else {
        this.removeAttribute('open');
      }
    }
  }

  private attachEventListeners(): void {
    this.documentClickHandler = (e: Event) => {
      if (!e.composedPath().includes(this)) {
        this.close();
      }
    };

    this.documentScrollHandler = (e: Event) => {
      if (this.menuOpen && !e.composedPath().includes(this)) {
        this.close();
      }
    };

    document.addEventListener('click', this.documentClickHandler);
    document.addEventListener('scroll', this.documentScrollHandler, true);
  }

  private detachEventListeners(): void {
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
    }
    if (this.documentScrollHandler) {
      document.removeEventListener('scroll', this.documentScrollHandler, true);
    }
  }

  private handleToggleMenu = (e: Event) => {
    e.stopPropagation();
    this.menuOpen = !this.menuOpen;

    if (this.menuOpen) {
      this.dispatchEvent(new CustomEvent('menu-open', {
        bubbles: true,
        composed: true
      }));
    }
  };

  public close(): void {
    this.menuOpen = false;
    const container = this.shadowRoot?.querySelector('.dropdown-container');
    if (container) container.scrollTop = 0;
  }

  private handleOptionChange(value: string) {
    this.dispatchEvent(new CustomEvent('selection-change', {
      detail: { value },
      bubbles: true,
      composed: true
    }));
    this.close();
  }

  render() {
    const currentOption = this.options.find(opt => opt.value === this.selectedValue);
    const currentLabel = currentOption?.label || (this.clearOptionLabel || 'Select...');
    const radioGroupName = `selection-${this.title.replace(/\s+/g, '-').toLowerCase()}`;

    return html`
      ${this.menuOpen ? html`
        <div class="backdrop" 
          @click=${this.close} 
          @wheel=${(e: Event) => e.preventDefault()} 
          @touchmove=${(e: Event) => e.preventDefault()}>
        </div>` : ''}

      <button
        class="menu-trigger"
        aria-haspopup="listbox"
        aria-expanded="${this.menuOpen}"
        title="${this.title}"
        @click=${this.handleToggleMenu}>
        <slot name="icon"></slot>
        <span>${currentLabel}</span>
      </button>

      <div class="dropdown-container" role="listbox">
        ${when(this.clearOptionLabel, () => html`
          <label class="menu-item">
            <input
              type="radio"
              name="${radioGroupName}"
              value=""
              .checked=${live(!this.selectedValue)}
              @change=${() => this.handleOptionChange('')}>
            <span>${this.clearOptionLabel}</span>
          </label>
        `)}

        ${map(this.options, opt => html`
          <label class="menu-item">
            <input
              type="radio"
              name="${radioGroupName}"
              value="${opt.value}"
              .checked=${live(opt.value === this.selectedValue)}
              @change=${() => this.handleOptionChange(opt.value)}>
            <span>${opt.label}</span>
          </label>
        `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'selection-menu': SelectionMenuComponent;
  }
}
