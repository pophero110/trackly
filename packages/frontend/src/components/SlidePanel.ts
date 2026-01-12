import { URLStateManager } from '../utils/urlState.js';

/**
 * SlidePanel component for displaying entry details in a right-to-left sliding panel
 */
export class SlidePanel extends HTMLElement {
  private isOpen: boolean = false;

  connectedCallback(): void {
    this.render();
    this.attachEventListeners();
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

    // Close on backdrop click
    backdrop?.addEventListener('click', () => {
      this.close();
    });

    // Close on close button click
    closeBtn?.addEventListener('click', () => {
      this.close();
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  open(contentElement: HTMLElement): void {
    const contentEl = this.querySelector('.slide-panel-body');

    if (contentEl) {
      contentEl.innerHTML = '';
      contentEl.appendChild(contentElement);
    }

    this.isOpen = true;
    this.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
  }

  close(): void {
    if (!this.isOpen) return; // Already closed

    this.isOpen = false;

    // Remove active class to trigger slide-out animation
    this.classList.remove('active');

    // Wait for animation to complete before cleanup (300ms animation duration + small buffer)
    setTimeout(() => {
      document.body.style.overflow = ''; // Restore scroll

      // Navigate to clean URL without entry detail if we came from an entry detail URL
      const path = window.location.pathname;
      if (path.match(/^\/entries\/([^/]+)$/)) {
        // Get the previous view from session storage
        const previousView = sessionStorage.getItem('previousView') || 'entries';
        const previousEntitySlug = sessionStorage.getItem('previousEntitySlug');

        // Navigate to the appropriate list view
        if (previousView === 'entities') {
          window.history.pushState({}, '', '/entities');
        } else if (previousEntitySlug) {
          window.history.pushState({}, '', `/entries?entity=${previousEntitySlug}`);
        } else {
          window.history.pushState({}, '', '/entries');
        }

        // Trigger popstate to update the view
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }, 350); // Wait for 300ms animation + 50ms buffer
  }
}
