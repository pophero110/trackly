import { Store } from './state/Store.js';
import { storeRegistry } from './state/StoreRegistry.js';
import { URLStateManager } from './utils/urlState.js';
import { AppTabs } from './components/AppTabs.js';
import { ModalPanel } from './components/ModalPanel.js';
import { EntityCreateFormComponent } from './components/EntityCreateFormComponent.js';
import { EntityEditFormComponent } from './components/EntityEditFormComponent.js';
import { EntityListComponent } from './components/EntityListComponent.js';
import { EntityGridComponent } from './components/EntityGridComponent.js';
import { EntryFormComponent } from './components/EntryFormComponent.js';
import { EntryEditFormComponent } from './components/EntryEditFormComponent.js';
import { EntryListComponent } from './components/EntryListComponent.js';
import { EntryDetailComponent } from './components/EntryDetailComponent.js';
import './components/AuthComponent.js'; // Register custom element
import { APIClient } from './api/client.js';

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

        // Set up sign-out button
        this.setupSignOut();

        // Set up logo home link
        this.setupLogoLink();

        // Set up navigation links
        this.setupEntriesLink();
        this.setupEntitiesLink();
    }

    private setupViewRouting(): void {
        const entityGrid = document.querySelector('entity-grid') as HTMLElement;
        const entryList = document.querySelector('entry-list') as HTMLElement;
        const entryDetail = document.querySelector('entry-detail') as HTMLElement;
        const panel = document.querySelector('modal-panel') as any;

        // Track last loaded sort to prevent infinite reload loop
        let lastSortBy: string | undefined = undefined;
        let lastSortOrder: 'asc' | 'desc' | undefined = undefined;

        const updatePageTitle = (view: string, entityName?: string, entryTitle?: string) => {
            let title = 'Trackly';

            if (entryTitle) {
                title = `${entryTitle} - Trackly`;
            } else if (view === 'entities') {
                title = 'Entities - Trackly';
            } else if (view === 'entries' && entityName) {
                title = `${entityName} - Trackly`;
            } else if (view === 'entries') {
                title = 'Entries - Trackly';
            }

            document.title = title;
        };

        const updateView = () => {
            const path = window.location.pathname;
            const view = URLStateManager.getView();
            const entitySlug = URLStateManager.getSelectedEntityName();
            const panelType = URLStateManager.getPanel();

            // Redirect home (/) to /entries
            if (path === '/') {
                URLStateManager.showHome();
                return;
            }

            // Check if we're on an entry detail page
            const entryDetailMatch = path.match(/^\/entries\/([^/]+)$/);
            if (entryDetailMatch) {
                // Show entry detail page
                if (entityGrid) entityGrid.style.display = 'none';
                if (entryList) entryList.style.display = 'none';
                if (entryDetail) entryDetail.style.display = 'block';
                // Only update if changed to avoid infinite loop
                if (this.store.getSelectedEntityId() !== null) {
                    this.store.setSelectedEntityId(null);
                }

                // Update page title with entry info if available
                const entryId = entryDetailMatch[1];
                if (this.store.getIsLoaded()) {
                    const entry = this.store.getEntryById(entryId);
                    if (entry) {
                        const entity = this.store.getEntityById(entry.entityId);
                        const entryTitle = entry.notes ? entry.notes.split('\n')[0].trim().substring(0, 50) : entity?.name || 'Entry';
                        updatePageTitle('entry-detail', undefined, entryTitle);
                    } else {
                        updatePageTitle('entry-detail');
                    }
                } else {
                    updatePageTitle('entry-detail');
                }

                // Still handle panel state for entry detail page
                this.updatePanelState(panelType, panel);
                return;
            }

            // Hide entry detail for other views
            if (entryDetail) entryDetail.style.display = 'none';

            // Look up entity by slug (case-insensitive match)
            let entity = null;
            if (entitySlug && this.store.getIsLoaded()) {
                const entities = this.store.getEntities();
                entity = entities.find(e =>
                    e.name.toLowerCase().replace(/\s+/g, '-') === entitySlug.toLowerCase()
                ) || null;
            }

            // Handle view routing
            if (view === 'entries' && entitySlug) {
                // Show entry list for specific entity
                if (entityGrid) entityGrid.style.display = 'none';
                if (entryList) {
                    entryList.style.display = 'block';

                    // Reload entries only if sort has changed
                    const sortBy = URLStateManager.getSortBy() || undefined;
                    const sortOrder = URLStateManager.getSortOrder() || undefined;
                    if (sortBy !== lastSortBy || sortOrder !== lastSortOrder) {
                        lastSortBy = sortBy;
                        lastSortOrder = sortOrder;
                        this.store.reloadEntries(sortBy, sortOrder);
                    } else {
                        // Just re-render with existing data
                        (entryList as any).render();
                    }
                }

                // Set entity ID if found, or null if still loading
                const targetEntityId = entity ? entity.id : null;

                // Only update if changed to avoid infinite loop
                if (this.store.getSelectedEntityId() !== targetEntityId) {
                    this.store.setSelectedEntityId(targetEntityId);
                }

                // Update page title with entity name
                updatePageTitle('entries', entity?.name);
            } else if (view === 'entities') {
                // Show entity grid
                if (entityGrid) {
                    entityGrid.style.display = 'block';
                    // Force re-render when showing entity grid
                    (entityGrid as any).render();
                }
                if (entryList) entryList.style.display = 'none';
                if (this.store.getSelectedEntityId() !== null) {
                    this.store.setSelectedEntityId(null);
                }

                // Update page title
                updatePageTitle('entities');
            } else if (view === 'entries') {
                // All entries view (/entries)
                if (entityGrid) entityGrid.style.display = 'none';
                if (entryList) {
                    entryList.style.display = 'block';

                    // Reload entries only if sort has changed
                    const sortBy = URLStateManager.getSortBy() || undefined;
                    const sortOrder = URLStateManager.getSortOrder() || undefined;
                    if (sortBy !== lastSortBy || sortOrder !== lastSortOrder) {
                        lastSortBy = sortBy;
                        lastSortOrder = sortOrder;
                        this.store.reloadEntries(sortBy, sortOrder);
                    } else {
                        // Just re-render with existing data
                        (entryList as any).render();
                    }
                }
                if (this.store.getSelectedEntityId() !== null) {
                    this.store.setSelectedEntityId(null);
                }

                // Update page title
                updatePageTitle('entries');
            } else {
                // Fallback - show all recent entries
                if (entityGrid) entityGrid.style.display = 'none';
                if (entryList) {
                    entryList.style.display = 'block';

                    // Reload entries only if sort has changed
                    const sortBy = URLStateManager.getSortBy() || undefined;
                    const sortOrder = URLStateManager.getSortOrder() || undefined;
                    if (sortBy !== lastSortBy || sortOrder !== lastSortOrder) {
                        lastSortBy = sortBy;
                        lastSortOrder = sortOrder;
                        this.store.reloadEntries(sortBy, sortOrder);
                    } else {
                        // Just re-render with existing data
                        (entryList as any).render();
                    }
                }
                if (this.store.getSelectedEntityId() !== null) {
                    this.store.setSelectedEntityId(null);
                }
            }

            // Handle panel state
            this.updatePanelState(panelType, panel);
        };

        // Subscribe to URL changes
        URLStateManager.subscribe(updateView);

        // Subscribe to store changes (for when data loads)
        this.store.subscribe(updateView);

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
            const formTemplate = document.querySelector('#entity-create-form-template');
            if (formTemplate && !panel.getIsOpen()) {
                const formClone = formTemplate.cloneNode(true) as HTMLElement;
                formClone.removeAttribute('id');
                formClone.style.display = 'block';

                const createForm = formClone as any;
                if (createForm && typeof createForm.setCreateMode === 'function') {
                    createForm.setCreateMode();
                }

                panel.open('Create New Entity', formClone);
            }
        } else if (panelType === 'edit-entity') {
            // Open edit entity panel
            const editEntitySlug = URLStateManager.getEditEntityName();
            // Find entity by matching slug (lowercase with hyphens)
            let entity = null;
            if (editEntitySlug) {
                const entities = this.store.getEntities();
                entity = entities.find(e =>
                    e.name.toLowerCase().replace(/\s+/g, '-') === editEntitySlug.toLowerCase()
                ) || null;
            }

            if (entity) {
                const formTemplate = document.querySelector('#entity-edit-form-template');
                if (formTemplate && !panel.getIsOpen()) {
                    const formClone = formTemplate.cloneNode(true) as HTMLElement;
                    formClone.removeAttribute('id');
                    formClone.style.display = 'block';

                    const editForm = formClone as any;
                    if (editForm && typeof editForm.setEditMode === 'function') {
                        editForm.setEditMode(entity.id);
                    }

                    panel.open('Edit Entity', formClone);
                }
            }
        } else if (panelType === 'clone-entity') {
            // Open clone entity panel
            const cloneEntitySlug = URLStateManager.getCloneEntityName();
            // Find entity by matching slug (lowercase with hyphens)
            let entity = null;
            if (cloneEntitySlug) {
                const entities = this.store.getEntities();
                entity = entities.find(e =>
                    e.name.toLowerCase().replace(/\s+/g, '-') === cloneEntitySlug.toLowerCase()
                ) || null;
            }

            if (entity) {
                const formTemplate = document.querySelector('#entity-create-form-template');
                if (formTemplate && !panel.getIsOpen()) {
                    const formClone = formTemplate.cloneNode(true) as HTMLElement;
                    formClone.removeAttribute('id');
                    formClone.style.display = 'block';

                    const createForm = formClone as any;
                    if (createForm && typeof createForm.setCloneMode === 'function') {
                        createForm.setCloneMode(entity);
                    }

                    panel.open('Clone Entity', formClone);
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
        customElements.define('modal-panel', ModalPanel);
        customElements.define('entity-create-form', EntityCreateFormComponent);
        customElements.define('entity-edit-form', EntityEditFormComponent);
        customElements.define('entity-list', EntityListComponent);
        customElements.define('entity-grid', EntityGridComponent);
        customElements.define('entry-form', EntryFormComponent);
        customElements.define('entry-edit-form', EntryEditFormComponent);
        customElements.define('entry-list', EntryListComponent);
        customElements.define('entry-detail', EntryDetailComponent);
    }

    private setupSignOut(): void {
        const hamburgerBtn = document.getElementById('hamburger-btn');
        const dropdownMenu = document.getElementById('dropdown-menu');
        const signOutBtn = document.getElementById('signout-btn');

        // Toggle dropdown menu
        if (hamburgerBtn && dropdownMenu) {
            hamburgerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdownMenu.classList.toggle('open');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                if (dropdownMenu.classList.contains('open')) {
                    dropdownMenu.classList.remove('open');
                }
            });

            // Prevent dropdown from closing when clicking inside it
            dropdownMenu.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Handle sign out
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to sign out?')) {
                    APIClient.logout();
                }
            });
        }
    }

    private setupLogoLink(): void {
        const logoLink = document.getElementById('logo-link');
        if (logoLink) {
            logoLink.addEventListener('click', (e) => {
                e.preventDefault();
                // Navigate to home (recent entries view)
                URLStateManager.showHome();
            });
        }
    }

    private setupEntriesLink(): void {
        const entriesLink = document.getElementById('entries-link');
        if (entriesLink) {
            entriesLink.addEventListener('click', (e) => {
                e.preventDefault();
                // Navigate to entries view (home - all recent entries)
                URLStateManager.showHome();
            });
        }
    }

    private setupEntitiesLink(): void {
        const entitiesLink = document.getElementById('entities-link');
        if (entitiesLink) {
            entitiesLink.addEventListener('click', (e) => {
                e.preventDefault();
                // Navigate to entities grid view
                URLStateManager.setView('entities');
            });
        }
    }

    getStore(): Store {
        return this.store;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!APIClient.isAuthenticated()) {
        // Show auth component
        document.body.innerHTML = '<auth-component></auth-component>';
        return;
    }

    // User is authenticated, show main app
    (window as any).app = new TracklyApp();
});

export default TracklyApp;
