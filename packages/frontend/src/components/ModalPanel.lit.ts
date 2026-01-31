import { html, LitElement } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { URLStateManager } from '../utils/urlState.js';

/**
 * ModalPanel component for displaying forms in a centered modal
 * Lit version of the original ModalPanel component
 * Note: Does not extend LitBaseComponent since it doesn't use the store
 */
@customElement('modal-panel')
export class ModalPanel extends LitElement {
  @state()
  private isOpen: boolean = false;

  @state()
  private title: string = '';

  @state()
  private contentElement: HTMLElement | null = null;

  @query('.modal-backdrop')
  private backdrop?: HTMLElement;

  /**
   * Disable Shadow DOM to maintain compatibility with existing global styles
   */
  createRenderRoot() {
    return this; // Render in light DOM (no shadow root)
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.attachKeyboardListeners();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeKeyboardListeners();
  }

  private attachKeyboardListeners(): void {
    document.addEventListener('keydown', this.handleEscape);
  }

  private removeKeyboardListeners(): void {
    document.removeEventListener('keydown', this.handleEscape);
  }

  private handleEscape = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.isOpen) {
      // Don't close if zen mode is open
      const zenOverlay = this.querySelector('#zen-mode-overlay') as HTMLElement;
      if (zenOverlay && zenOverlay.style.display !== 'none') {
        return; // Let zen mode handle the escape
      }

      // Don't close if user is typing in an input or textarea
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'SELECT'
      )) {
        return; // Let the input field handle the escape (blur)
      }

      this.tryClose();
    }
  };

  private handleBackdropClick = (e: MouseEvent): void => {
    if (e.target === this.backdrop) {
      this.tryClose();
    }
  };

  private handleCloseClick = (): void => {
    this.tryClose();
  };

  private tryClose(): void {
    // Check if content component has unsaved changes
    if (this.contentElement) {
      const component = this.contentElement as any;
      if (typeof component.checkUnsavedChanges === 'function') {
        if (!component.checkUnsavedChanges()) {
          return; // Don't close if user cancels
        }
      }
    }
    URLStateManager.closePanel();
  }

  open(title: string, contentElement: HTMLElement): void {
    this.title = title;
    this.contentElement = contentElement;
    this.isOpen = true;
    this.classList.add('active');
  }

  close(): void {
    this.isOpen = false;
    this.title = '';
    this.contentElement = null;
    this.classList.remove('active');
  }

  getIsOpen(): boolean {
    return this.isOpen;
  }

  render() {
    return html`
      <div class="modal-backdrop" @click=${this.handleBackdropClick}>
        <div class="modal-dialog">
          <div class="modal-header">
            <h2 class="modal-title">${this.title}</h2>
            <button class="modal-close" aria-label="Close" @click=${this.handleCloseClick}>×</button>
          </div>
          <div class="modal-body">
            ${this.contentElement}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'modal-panel': ModalPanel;
  }
}
