/**
 * AppTabs Web Component for navigation between different views
 */
export class AppTabs extends HTMLElement {
    private currentTab: string;

    constructor() {
        super();
        this.currentTab = 'entities';
    }

    connectedCallback(): void {
        this.attachEventListeners();
    }

    private attachEventListeners(): void {
        this.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const tabName = target.dataset.tab;
                if (tabName) {
                    this.switchTab(tabName);
                }
            });
        });
    }

    switchTab(tabName: string): void {
        this.currentTab = tabName;

        // Update tab buttons
        this.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = this.querySelector(`[data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        const activeContent = document.getElementById(`${tabName}-tab`);
        if (activeContent) {
            activeContent.classList.add('active');
        }
    }

    getCurrentTab(): string {
        return this.currentTab;
    }
}
