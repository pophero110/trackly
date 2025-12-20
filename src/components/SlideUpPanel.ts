import { URLStateManager } from '../utils/urlState.js';

/**
 * SlideUpPanel component for displaying forms in a centered modal
 */
export class SlideUpPanel extends HTMLElement {
    private isOpen: boolean = false;

    connectedCallback(): void {
        this.render();
        this.attachEventListeners();
    }

    private render(): void {
        this.innerHTML = `
            <div class="modal-backdrop">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h2 class="modal-title"></h2>
                        <button class="modal-close" aria-label="Close">×</button>
                    </div>
                    <div class="modal-body"></div>
                </div>
            </div>
        `;
    }

    private attachEventListeners(): void {
        const backdrop = this.querySelector('.modal-backdrop');
        const closeBtn = this.querySelector('.modal-close');

        // Close on backdrop click
        backdrop?.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                URLStateManager.closePanel();
            }
        });

        // Close on close button click
        closeBtn?.addEventListener('click', () => {
            URLStateManager.closePanel();
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                URLStateManager.closePanel();
            }
        });
    }

    open(title: string, contentElement: HTMLElement): void {
        const titleEl = this.querySelector('.modal-title');
        const contentEl = this.querySelector('.modal-body');

        if (titleEl && contentEl) {
            titleEl.textContent = title;
            contentEl.innerHTML = '';
            contentEl.appendChild(contentElement);
        }

        this.isOpen = true;
        this.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    close(): void {
        this.isOpen = false;
        this.classList.remove('active');
        document.body.style.overflow = ''; // Restore scroll

        // Clear content immediately (no animation delay needed)
        const contentEl = this.querySelector('.modal-body');
        if (contentEl) {
            contentEl.innerHTML = '';
        }
    }

    getIsOpen(): boolean {
        return this.isOpen;
    }
}
