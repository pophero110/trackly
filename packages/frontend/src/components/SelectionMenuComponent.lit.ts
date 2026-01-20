import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { escapeHtml } from '../utils/helpers.js';

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
  @property({ type: Array })
  options: SelectionOption[] = [];

  @property({ type: String })
  selectedValue: string = '';

  @property({ type: String })
  icon: string = ''; // Phosphor icon class (e.g., "ph-duotone ph-sort-ascending")

  @property({ type: String })
  title: string = '';

  @property({ type: String })
  clearOptionLabel: string = ''; // If set, shows a "clear" option at top

  @state()
  private menuOpen: boolean = false;

  private documentClickHandler?: (e: Event) => void;

  // Disable Shadow DOM for compatibility with existing global styles
  createRenderRoot() {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.attachDocumentListener();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.detachDocumentListener();
  }

  private attachDocumentListener(): void {
    this.documentClickHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      // Close menu if clicked outside
      if (!target.closest('.tag-filter-container') ||
          !this.contains(target.closest('.tag-filter-container') as Node)) {
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

  private handleToggleMenu = (e: Event) => {
    e.stopPropagation();
    this.menuOpen = !this.menuOpen;
  };

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

  private handleClearSelection = (e: Event) => {
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
      <div class="tag-filter-container">
        <button
          class="btn-tag-filter"
          title="${this.title}"
          @click=${this.handleToggleMenu}>
          ${when(this.icon, () => html`<i class="${this.icon}"></i>`)}
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
                ?checked=${!this.selectedValue}
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
                ?checked=${opt.value === this.selectedValue}
                @change=${this.handleOptionChange}>
              <span>${escapeHtml(opt.label)}</span>
            </label>
          `)}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'selection-menu': SelectionMenuComponent;
  }
}
