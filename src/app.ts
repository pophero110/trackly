import { Store } from './state/Store.js';
import { storeRegistry } from './state/StoreRegistry.js';
import { AppTabs } from './components/AppTabs.js';
import { SlideUpPanel } from './components/SlideUpPanel.js';
import { EntityUpsertFormComponent } from './components/EntityUpsertFormComponent.js';
import { EntityListComponent } from './components/EntityListComponent.js';
import { EntityGridComponent } from './components/EntityGridComponent.js';
import { EntryFormComponent } from './components/EntryFormComponent.js';
import { EntryListComponent } from './components/EntryListComponent.js';

/**
 * Main application orchestrator
 */
class TracklyApp {
    private store: Store;

    constructor() {
        this.store = new Store();
        this.init();
    }

    private init(): void {
        console.log('Initializing Trackly app...');

        // Register store in the global registry for Web Components
        storeRegistry.setStore(this.store);

        // Register all Web Components
        this.registerComponents();

        console.log('Trackly app initialized successfully');
    }

    private registerComponents(): void {
        // Register custom elements
        customElements.define('app-tabs', AppTabs);
        customElements.define('slide-up-panel', SlideUpPanel);
        customElements.define('entity-upsert-form', EntityUpsertFormComponent);
        customElements.define('entity-list', EntityListComponent);
        customElements.define('entity-grid', EntityGridComponent);
        customElements.define('entry-form', EntryFormComponent);
        customElements.define('entry-list', EntryListComponent);
    }

    getStore(): Store {
        return this.store;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    (window as any).app = new TracklyApp();
});

export default TracklyApp;
