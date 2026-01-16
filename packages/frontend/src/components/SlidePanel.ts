import { URLStateManager } from '../utils/urlState.js';
import { EntryDetailComponent } from './EntryDetailComponent.js';

/**
 * SlidePanel component for displaying entry details in a right-to-left sliding panel
 * Uses URL state as the single source of truth (ADR 0002)
 */
export class SlidePanel extends HTMLElement {
  private unsubscribeUrl: (() => void) | null = null;
  private currentEntryId: string | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  connectedCallback(): void {
    this.render();
    this.attachEventListeners();

    // Subscribe to URL changes to automatically open/close panel
    this.unsubscribeUrl = URLStateManager.subscribe(() => {
      this.updatePanelState();
    });

    // Initial update based on current URL
    this.updatePanelState();
  }

  disconnectedCallback(): void {
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

  private render(): void {
    this.innerHTML = `
      <div class="slide-panel-backdrop"></div>
      <div class="slide-panel-container">
        <div class="slide-panel-header">
          <button class="slide-panel-close" aria-label="Close">
            <i class="ph ph-x"></i>
          </button>
        </div>
        <div class="slide-panel-body"></div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    const backdrop = this.querySelector('.slide-panel-backdrop');
    const closeBtn = this.querySelector('.slide-panel-close');

    // Close on backdrop click - navigates back
    backdrop?.addEventListener('click', () => {
      this.navigateBack();
    });

    // Close on close button click - navigates back
    closeBtn?.addEventListener('click', () => {
      this.navigateBack();
    });

    // Remove old keydown handler if exists
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
    }

    // Close on escape key - navigates back
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.classList.contains('active')) {
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
    // Create and render EntryDetailComponent for current entry
    const contentEl = this.querySelector('.slide-panel-body');

    if (contentEl) {
      // Clear previous content
      contentEl.innerHTML = '';

      // Create new EntryDetailComponent
      const detailComponent = new EntryDetailComponent();
      contentEl.appendChild(detailComponent);
    }

    this.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
  }

  private closePanel(): void {
    // Remove active class to trigger slide-out animation
    this.classList.remove('active');

    // Wait for animation to complete
    const container = this.querySelector('.slide-panel-container');
    const handleAnimationEnd = () => {
      container?.removeEventListener('animationend', handleAnimationEnd);

      document.body.style.overflow = ''; // Restore scroll

      const contentEl = this.querySelector('.slide-panel-body');
      if (contentEl) {
        contentEl.innerHTML = ''; // Clear content to disconnect child components
      }
    };

    container?.addEventListener('animationend', handleAnimationEnd);
  }

  private navigateBack(): void {
    window.history.back();
  }
}
