/**
 * SlideUpPanel component for displaying forms in a modal panel
 */
export class SlideUpPanel extends HTMLElement {
    private isOpen: boolean = false;

    connectedCallback(): void {
        this.render();
        this.attachEventListeners();
    }

    private render(): void {
        this.innerHTML = `
            <div class="panel-backdrop">
                <div class="panel-container">
                    <div class="panel-header">
                        <h2 class="panel-title"></h2>
                        <button class="panel-close" aria-label="Close">×</button>
                    </div>
                    <div class="panel-content"></div>
                </div>
            </div>
        `;
    }

    private attachEventListeners(): void {
        const backdrop = this.querySelector('.panel-backdrop');
        const closeBtn = this.querySelector('.panel-close');

        // Close on backdrop click
        backdrop?.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                this.close();
            }
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

    open(title: string, contentElement: HTMLElement): void {
        const titleEl = this.querySelector('.panel-title');
        const contentEl = this.querySelector('.panel-content');

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

        // Clear content after animation
        setTimeout(() => {
            const contentEl = this.querySelector('.panel-content');
            if (contentEl) {
                contentEl.innerHTML = '';
            }
        }, 300);
    }

    getIsOpen(): boolean {
        return this.isOpen;
    }
}
