import { html, css, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';

/**
 * TagAutocompleteDropdown - Dropdown for tag autocomplete triggered by typing #
 *
 * Features:
 * - Case-insensitive filtering
 * - Keyboard navigation (Arrow Up/Down, Enter, Escape)
 * - Click to select
 * - Mouse hover updates selection
 * - Shows # prefix before each tag name
 * - Limit to 10 results
 */
@customElement('tag-autocomplete-dropdown')
export class TagAutocompleteDropdown extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .dropdown {
      position: fixed;
      background: var(--surface);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-lg);
      min-width: 200px;
      max-height: 300px;
      overflow-y: auto;
      z-index: 1000;
      padding: 4px 0;
      overscroll-behavior: contain;
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease;
      user-select: none;
      font-size: 0.875rem;
      border-left: 3px solid transparent;
      margin: 2px 4px;
      border-radius: var(--radius-sm);
    }

    .dropdown-item:hover {
      background: var(--background);
    }

    .dropdown-item.selected {
      background: color-mix(in srgb, var(--primary) 15%, transparent);
      border-left-color: var(--primary);
    }

    .hash-prefix {
      color: var(--text-secondary);
      font-weight: 500;
    }

    .dropdown-item.selected .hash-prefix {
      color: var(--primary);
    }

    .tag-name {
      color: var(--text-primary);
      font-weight: 500;
    }

    .dropdown-item.selected .tag-name {
      color: var(--primary);
      font-weight: 600;
    }

    .empty-state {
      padding: 12px 16px;
      color: var(--text-secondary);
      font-size: 0.875rem;
      text-align: center;
    }

    .backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 999;
      background: transparent;
    }
  `;

  @property({ type: Array })
  tags: string[] = [];

  @property({ type: String })
  query: string = '';

  @property({ type: Boolean })
  open: boolean = false;

  @property({ type: Object })
  anchorRect: DOMRect | null = null;

  @state()
  private selectedIndex: number = 0;

  private get filteredTags(): string[] {
    const lowerQuery = this.query.toLowerCase();
    const filtered = this.tags
      .filter(tag => tag.toLowerCase().includes(lowerQuery))
      .slice(0, 10);
    return filtered;
  }

  updated(changedProperties: Map<string, unknown>): void {
    // Reset selection when query changes
    if (changedProperties.has('query')) {
      this.selectedIndex = 0;
    }
  }

  /**
   * Handle keyboard navigation
   * Returns true if key was consumed, false otherwise
   */
  handleKeydown(e: KeyboardEvent): boolean {
    if (!this.open) return false;

    const filtered = this.filteredTags;
    if (filtered.length === 0 && e.key !== 'Escape') return false;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, filtered.length - 1);
        this.scrollSelectedIntoView();
        return true;

      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.scrollSelectedIntoView();
        return true;

      case 'Enter':
        e.preventDefault();
        if (filtered.length > 0) {
          this.selectTag(filtered[this.selectedIndex]);
        }
        return true;

      case 'Escape':
        e.preventDefault();
        this.close();
        return true;

      default:
        return false;
    }
  }

  private scrollSelectedIntoView(): void {
    this.updateComplete.then(() => {
      const items = this.shadowRoot?.querySelectorAll('.dropdown-item');
      if (items && items[this.selectedIndex]) {
        items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
      }
    });
  }

  private selectTag(tagName: string): void {
    this.dispatchEvent(new CustomEvent('tag-selected', {
      detail: { tagName },
      bubbles: true,
      composed: true
    }));
    this.close();
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('dropdown-close', {
      bubbles: true,
      composed: true
    }));
  }

  private handleItemClick(tagName: string): void {
    this.selectTag(tagName);
  }

  private handleItemMouseEnter(index: number): void {
    this.selectedIndex = index;
  }

  private handleBackdropClick = (e: MouseEvent) => {
    e.stopPropagation();
    this.close();
  };

  render() {
    if (!this.open || !this.anchorRect) {
      return nothing;
    }

    const filtered = this.filteredTags;
    const left = this.anchorRect.left;
    const top = this.anchorRect.bottom + 4;

    return html`
      <div class="backdrop" @click=${this.handleBackdropClick}></div>
      <div
        class="dropdown"
        style="left: ${left}px; top: ${top}px;">
        ${filtered.length === 0
          ? html`<div class="empty-state">No matching tags</div>`
          : map(filtered, (tag, index) => html`
              <div
                class="dropdown-item ${index === this.selectedIndex ? 'selected' : ''}"
                @click=${() => this.handleItemClick(tag)}
                @mouseenter=${() => this.handleItemMouseEnter(index)}>
                <span class="hash-prefix">#</span>
                <span class="tag-name">${tag}</span>
              </div>
            `)
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tag-autocomplete-dropdown': TagAutocompleteDropdown;
  }
}
