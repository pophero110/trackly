import { html, LitElement } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { URLStateManager } from '../utils/urlState.js';
import type { EntryDetailComponent } from './EntryDetailComponent.js';

/**
 * SlidePanel component for displaying entry details in a right-to-left sliding panel
 * Uses URL state as the single source of truth (ADR 0002)
 * Lit version of the original SlidePanel component
 * Note: Does not extend LitBaseComponent since it doesn't use the store
 */
@customElement('slide-panel')
export class SlidePanel extends LitElement {
  @state()
  private currentEntryId: string | null = null;

  @state()
  private isActive: boolean = false;

  @query('.slide-panel-backdrop')
  private backdrop?: HTMLElement;

  @query('.slide-panel-container')
  private container?: HTMLElement;

  @query('.slide-panel-body')
  private panelBody?: HTMLElement;

  private unsubscribeUrl: (() => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  /**
   * Disable Shadow DOM to maintain compatibility with existing global styles
   */
  createRenderRoot() {
    return this; // Render in light DOM (no shadow root)
  }

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
    // Check if current path matches /entries/:id pattern
    const path = window.location.pathname;
    const entryDetailMatch = path.match(/^\/entries\/([^/]+)$/);

    if (entryDetailMatch) {
      const entryId = entryDetailMatch[1];

      // Only update if entry ID changed (avoid unnecessary re-renders)
      if (entryId !== this.currentEntryId) {
        this.currentEntryId = entryId;
        this.openPanel();
      }
    } else {
      // Not on entry detail path - close panel if open
      if (this.currentEntryId !== null) {
        this.currentEntryId = null;
        this.closePanel();
      }
    }
  }

  private openPanel(): void {
    this.isActive = true;
    this.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scroll

    // Wait for next frame to ensure panelBody is rendered
    requestAnimationFrame(() => {
      if (this.panelBody) {
        // Clear previous content
        this.panelBody.innerHTML = '';

        // Create new EntryDetailComponent using DOM API (custom elements must be created this way)
        const detailComponent = document.createElement('entry-detail') as EntryDetailComponent;
        this.panelBody.appendChild(detailComponent);
      }
    });
  }

  private closePanel(): void {
    // Remove active class to trigger slide-out animation
    this.isActive = false;
    this.classList.remove('active');

    // Wait for animation to complete
    const handleAnimationEnd = () => {
      this.container?.removeEventListener('animationend', handleAnimationEnd);

      document.body.style.overflow = ''; // Restore scroll

      if (this.panelBody) {
        this.panelBody.innerHTML = ''; // Clear content to disconnect child components
      }
    };

    this.container?.addEventListener('animationend', handleAnimationEnd);
  }

  private navigateBack(): void {
    window.history.back();
  }

  private handleBackdropClick = (): void => {
    this.navigateBack();
  };

  private handleCloseClick = (): void => {
    this.navigateBack();
  };

  render() {
    return html`
      <div class="slide-panel-backdrop" @click=${this.handleBackdropClick}>
        <button class="slide-panel-close" aria-label="Close" @click=${this.handleCloseClick}>
          <i class="ph ph-x"></i>
        </button>
      </div>
      <div class="slide-panel-container">
        <div class="slide-panel-body"></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'slide-panel': SlidePanel;
  }
}
