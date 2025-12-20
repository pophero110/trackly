import { Store } from './state/Store.js';
import { storeRegistry } from './state/StoreRegistry.js';
import { URLStateManager } from './utils/urlState.js';
import { AppTabs } from './components/AppTabs.js';
import { SlideUpPanel } from './components/SlideUpPanel.js';
import { EntityUpsertFormComponent } from './components/EntityUpsertFormComponent.js';
import { EntityListComponent } from './components/EntityListComponent.js';
import { EntityGridComponent } from './components/EntityGridComponent.js';
import { EntryFormComponent } from './components/EntryFormComponent.js';
import { EntryEditFormComponent } from './components/EntryEditFormComponent.js';
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
        // Register store in the global registry for Web Components
        storeRegistry.setStore(this.store);

        // Initialize URL state manager
        URLStateManager.init();

        // Register all Web Components
        this.registerComponents();

        // Set up view routing
        this.setupViewRouting();
    }

    private setupViewRouting(): void {
        const entityGrid = document.querySelector('entity-grid') as HTMLElement;
        const entryList = document.querySelector('entry-list') as HTMLElement;
        const panel = document.querySelector('slide-up-panel') as any;

        const updateView = () => {
            const view = URLStateManager.getView();
            const selectedEntityName = URLStateManager.getSelectedEntityName();
            const panelType = URLStateManager.getPanel();

            // Look up entity by name
            const entity = selectedEntityName ? this.store.getEntityByName(selectedEntityName) : null;

            // Handle view (grid vs entries)
            if (view === 'entries' && entity) {
                // Show entry list
                if (entityGrid) entityGrid.style.display = 'none';
                if (entryList) entryList.style.display = 'block';

                // Sync store with URL state
                this.store.setSelectedEntityId(entity.id);
            } else {
                // Show entity grid
                if (entityGrid) entityGrid.style.display = 'block';
                if (entryList) entryList.style.display = 'none';

                // Clear selection if not in URL or entity not found
                if (!entity) {
                    this.store.setSelectedEntityId(null);
                } else {
                    this.store.setSelectedEntityId(entity.id);
                }
            }

            // Handle panel state
            this.updatePanelState(panelType, panel);
        };

        // Subscribe to URL changes
        URLStateManager.subscribe(updateView);

        // Initial view setup
        updateView();
    }

    private updatePanelState(panelType: any, panel: any): void {
        if (!panel) return;

        if (panelType === 'log-entry') {
            const selectedEntityName = URLStateManager.getSelectedEntityName();
            const entity = selectedEntityName ? this.store.getEntityByName(selectedEntityName) : null;

            // Set selected entity in store if found
            if (entity) {
                this.store.setSelectedEntityId(entity.id);
            }

            // Open log entry panel
            const formTemplate = document.querySelector('#entry-form-template');
            if (formTemplate && !panel.getIsOpen()) {
                const formClone = formTemplate.cloneNode(true) as HTMLElement;
                formClone.removeAttribute('id');
                formClone.style.display = 'block';
                panel.open('Log New Entry', formClone);
            }
        } else if (panelType === 'create-entity') {
            // Open create entity panel
            const formTemplate = document.querySelector('#entity-upsert-form-template');
            if (formTemplate && !panel.getIsOpen()) {
                const formClone = formTemplate.cloneNode(true) as HTMLElement;
                formClone.removeAttribute('id');
                formClone.style.display = 'block';

                const upsertForm = formClone as any;
                if (upsertForm && typeof upsertForm.setCreateMode === 'function') {
                    upsertForm.setCreateMode();
                }

                panel.open('Create New Entity', formClone);
            }
        } else if (panelType === 'edit-entity') {
            // Open edit entity panel
            const editEntityName = URLStateManager.getEditEntityName();
            const entity = editEntityName ? this.store.getEntityByName(editEntityName) : null;

            if (entity) {
                const formTemplate = document.querySelector('#entity-upsert-form-template');
                if (formTemplate && !panel.getIsOpen()) {
                    const formClone = formTemplate.cloneNode(true) as HTMLElement;
                    formClone.removeAttribute('id');
                    formClone.style.display = 'block';

                    const upsertForm = formClone as any;
                    if (upsertForm && typeof upsertForm.setEditMode === 'function') {
                        upsertForm.setEditMode(entity.id);
                    }

                    panel.open('Edit Entity', formClone);
                }
            }
        } else if (panelType === 'edit-entry') {
            // Open edit entry panel
            const entryId = URLStateManager.getEntryId();
            if (entryId) {
                const formTemplate = document.querySelector('#entry-edit-form-template');
                if (formTemplate && !panel.getIsOpen()) {
                    const formClone = formTemplate.cloneNode(true) as HTMLElement;
                    formClone.removeAttribute('id');
                    formClone.style.display = 'block';

                    panel.open('Edit Entry', formClone);

                    // Wait for element to be connected before calling setEntry
                    setTimeout(() => {
                        const editForm = formClone as any;
                        if (editForm && typeof editForm.setEntry === 'function') {
                            editForm.setEntry(entryId);
                        }
                    }, 0);
                }
            }
        } else {
            // No panel in URL, close if open
            if (panel.getIsOpen()) {
                panel.close();
            }
        }
    }

    private registerComponents(): void {
        // Register custom elements
        customElements.define('app-tabs', AppTabs);
        customElements.define('slide-up-panel', SlideUpPanel);
        customElements.define('entity-upsert-form', EntityUpsertFormComponent);
        customElements.define('entity-list', EntityListComponent);
        customElements.define('entity-grid', EntityGridComponent);
        customElements.define('entry-form', EntryFormComponent);
        customElements.define('entry-edit-form', EntryEditFormComponent);
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
