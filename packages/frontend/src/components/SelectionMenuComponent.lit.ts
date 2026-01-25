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
 * Used for sort dropdowns, filter dropdowns, etc.
 * Follows the same pattern as sort/tag filters
 */
@customElement('selection-menu')
export class SelectionMenuComponent extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
      position: relative;
    }

    .btn-tag-filter {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 0px;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: var(--transition);
      outline: none;
      max-width: 300px;
    }

    .btn-tag-filter:hover {
      border-color: var(--text-muted);
      color: var(--text-primary);
      background: var(--background);
    }

    .btn-tag-filter ::slotted(*) {
      flex-shrink: 0;
      font-size: 1rem;
    }

    slot[name="icon"] {
      display: flex;
      align-items: center;
    }

    .tag-filter-menu {
      position: absolute;
      top: 100%;
      margin-top: 4px;
      background: var(--background);
      border: none;
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-lg);
      min-width: 200px;
      max-height: 300px;
      overflow-y: auto;
      z-index: 1000;
      padding: 0;
      left: 0px;
      right: auto;
      max-width: calc(-48px + 100vw);
    }

    .tag-filter-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px var(--base-size-16, 16px);
      cursor: pointer;
      transition: var(--transition);
      user-select: none;
    }

    .tag-filter-option:hover {
      background: var(--background);
    }

    .tag-filter-option input[type="checkbox"],
    .tag-filter-option input[type="radio"] {
      margin: 0;
      cursor: pointer;
    }

    .tag-filter-option span {
      font-size: 0.875rem;
      color: var(--text-primary);
      font-weight: 500;
    }

    @media (max-width: 480px) {
      .btn-tag-filter {
        min-height: 40px;
        padding: 7px 0px;
        font-size: 0.8125rem;
        max-width: 140px;
        position: relative;
      }

      .btn-tag-filter i {
        margin: 0;
      }
    }
  `;

  @property({ type: Array })
  options: SelectionOption[] = [];

  @property({ type: String })
  selectedValue: string = '';

  @property({ type: String })
  title: string = '';

  @property({ type: String })
  clearOptionLabel: string = ''; // If set, shows a "clear" option at top

  @state()
  private menuOpen: boolean = false;

  private documentClickHandler?: (e: Event) => void;
  private documentScrollHandler?: (e: Event) => void;

  connectedCallback(): void {
    super.connectedCallback();
    this.attachDocumentListener();
    this.attachScrollListener();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.detachDocumentListener();
    this.detachScrollListener();
  }

  private attachDocumentListener(): void {
    this.documentClickHandler = (e: Event) => {
      // Close menu if clicked outside this component
      const path = e.composedPath();
      if (!path.includes(this)) {
        this.menuOpen = false;
      }
    };
    document.addEventListener('click', this.documentClickHandler);
  }

  private detachDocumentListener(): void {
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
      this.documentClickHandler = undefined;
    }
  }

  private attachScrollListener(): void {
    this.documentScrollHandler = (e: Event) => {
      if (!this.menuOpen) return;

      // Check if scrolling inside this component
      const path = e.composedPath();
      if (path.includes(this)) {
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

  private handleToggleMenu = (e: Event) => {
    e.stopPropagation();
    const wasOpen = this.menuOpen;
    this.menuOpen = !this.menuOpen;

    // Dispatch event when menu opens
    if (this.menuOpen && !wasOpen) {
      this.dispatchEvent(new CustomEvent('menu-open', {
        bubbles: true,
        composed: true
      }));
    }
  };

  /**
   * Public method to close the menu from parent component
   */
  public close(): void {
    this.menuOpen = false;
    const menuContainer = this.shadowRoot?.querySelector('.tag-filter-menu') as HTMLElement;
    if (menuContainer) {
      menuContainer.scrollTop = 0;
    }
  }

  private handleOptionChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const value = target.value;

    // Dispatch custom event with selected value
    this.dispatchEvent(new CustomEvent('selection-change', {
      detail: { value },
      bubbles: true,
      composed: true
    }));

    this.menuOpen = false;
  };

  private handleClearSelection = () => {
    // Dispatch custom event with empty value
    this.dispatchEvent(new CustomEvent('selection-change', {
      detail: { value: '' },
      bubbles: true,
      composed: true
    }));

    this.menuOpen = false;
  };

  render() {
    // Find current selection label
    const currentOption = this.options.find(opt => opt.value === this.selectedValue);
    const currentLabel = currentOption?.label || (this.clearOptionLabel || 'Select...');

    // Generate unique ID for radio group
    const radioGroupName = `selection-${this.title.replace(/\s+/g, '-').toLowerCase()}`;

    return html`
      <button
        class="btn-tag-filter"
        title="${this.title}"
        @click=${this.handleToggleMenu}>
        <slot name="icon"></slot>
        <span>${currentLabel}</span>
      </button>
      <div
        class="tag-filter-menu"
        style="display: ${this.menuOpen ? 'block' : 'none'};">
        ${when(this.clearOptionLabel, () => html`
          <label class="tag-filter-option">
            <input
              type="radio"
              name="${radioGroupName}"
              value=""
              .checked=${live(!this.selectedValue)}
              @change=${this.handleClearSelection}>
            <span>${this.clearOptionLabel}</span>
          </label>
        `)}
        ${map(this.options, opt => html`
          <label class="tag-filter-option">
            <input
              type="radio"
              name="${radioGroupName}"
              value="${opt.value}"
              .checked=${live(opt.value === this.selectedValue)}
              @change=${this.handleOptionChange}>
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
