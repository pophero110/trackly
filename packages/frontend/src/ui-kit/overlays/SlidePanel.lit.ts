import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { URLStateManager } from '../../core/utils/urlState.js';

/**
 * SlidePanel component for displaying entry details in a right-to-left sliding panel
 * Uses URL state as the single source of truth (ADR 0002)
 * Lit version of the original SlidePanel component
 * Note: Does not extend LitBaseComponent since it doesn't use the store
 */
@customElement('slide-panel')
export class SlidePanel extends LitElement {
  static styles = css`
    :host {
      /* Always 'display' it so the transition can trigger, 
         but hide it visually and from clicks */
      display: block; 
      position: fixed;
      inset: 0;
      z-index: 999;
      pointer-events: none;
      visibility: hidden;
      transition: visibility 0.3s;
    }

    :host([active]) {
      visibility: visible;
      pointer-events: auto;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      opacity: 0;
      transition: opacity 0.3s ease;
      touch-action: none;
    }

    :host([active]) .backdrop {
      opacity: 1;
    }

    .body {
      position: fixed;
      left: 50%;
      margin-left: calc(-75ch / 2);
      bottom: 0;
      width: 75ch;
      height: 85vh;
      max-height: 800px;
      background: var(--background, #ffffff);
      box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
      border-radius: var(--radius-lg, 12px) var(--radius-lg, 12px) 0 0;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      overscroll-behavior: contain;

      /* START STATE: Pushed down off-screen */
      transform: translateY(100%);
      transition: transform 0.35s cubic-bezier(0.25, 1, 0.5, 1);
    }

    :host([active]) .body {
      /* END STATE: Slide up to original position */
      transform: translateY(0);
    }

    /* Mobile adjustments */
    @media (max-width: 768px) {
      .body {
        width: 100%;
        height: 90vh;
        left: 0;
        margin-left: 0;
      }
    }
  `;
  @state()
  private currentEntryId: string | null = null;

  @state()
  private isActive: boolean = false;

  private unsubscribeUrl: (() => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.attachKeyboardListener();

    // Subscribe to URL changes to automatically open/close panel
    this.unsubscribeUrl = URLStateManager.subscribe(() => {
      this.updatePanelState();
    });

    // Initial update based on current URL
    this.updatePanelState();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    // Clean up URL subscription
    if (this.unsubscribeUrl) {
      this.unsubscribeUrl();
      this.unsubscribeUrl = null;
    }

    // Clean up keydown handler
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
  }

  private attachKeyboardListener(): void {
    // Remove old keydown handler if exists
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
    }

    // Close on escape key - navigates back
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isActive) {
        this.navigateBack();
      }
    };
    document.addEventListener('keydown', this.keydownHandler);
  }

  private updatePanelState(): void {
    // Check if URL has ?id= query param for entry detail
    const params = new URLSearchParams(window.location.search);
    const entryId = params.get('id');

    if (entryId) {
      // Only update if entry ID changed (avoid unnecessary re-renders)
      if (entryId !== this.currentEntryId) {
        this.currentEntryId = entryId;
        this.openPanel();
      }
    } else {
      // No entry ID in URL - close panel if open
      if (this.currentEntryId !== null) {
        this.currentEntryId = null;
        this.closePanel();
      }
    }
  }

  private openPanel(): void {
    this.isActive = true;
    this.classList.add('active');
  }

  private closePanel(): void {
    this.isActive = false;
    this.classList.remove('active');
  }

  private navigateBack(): void {
    URLStateManager.navigateToOrigin();
  }

  private handleBackdropClick = (): void => {
    this.navigateBack();
  };

  private preventScroll = (e: Event): void => {
    e.preventDefault();
  };

  // IMPORTANT: Sync the internal state to the HTML attribute
  // so that :host([active]) in your CSS actually finds it.
  updated(changedProperties) {
    if (changedProperties.has('isActive')) {
      if (this.isActive) {
        this.setAttribute('active', '');
      } else {
        this.removeAttribute('active');
      }
    }
  }

  render() {
    return html`
      <div class="backdrop"
        @click=${this.handleBackdropClick}
        @wheel=${this.preventScroll}
        @touchmove=${this.preventScroll}></div>
      <div class="body">
        <slot></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'slide-panel': SlidePanel;
  }
}
