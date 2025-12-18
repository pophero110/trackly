import { WebComponent } from './WebComponent.js';
import { Entity } from '../models/Entity.js';
import { escapeHtml } from '../utils/helpers.js';

/**
 * EntityGrid Web Component for displaying entities in a grid layout on the home page
 */
export class EntityGridComponent extends WebComponent {
    private contextMenu: HTMLElement | null = null;
    private contextMenuEntityId: string | null = null;

    render(): void {
        const entities = this.store.getEntities();

        if (entities.length === 0) {
            this.innerHTML = `
                <div class="section">
                    <div class="section-header">
                        <h2>Your Entities</h2>
                        <button class="btn btn-primary" id="create-entity-btn">+ Create Entity</button>
                    </div>
                    <div class="empty-state">No entities yet. Create your first entity to get started!</div>
                </div>
                <div class="context-menu" id="entity-context-menu">
                    <div class="context-menu-item" data-action="edit">Edit</div>
                    <div class="context-menu-item danger" data-action="delete">Delete</div>
                </div>
            `;
            this.attachCreateButtonHandler();
            this.attachContextMenuHandlers();
            return;
        }

        const entitiesHtml = entities
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map(entity => this.renderEntityCard(entity))
            .join('');

        this.innerHTML = `
            <div class="section">
                <div class="section-header">
                    <h2>Your Entities</h2>
                    <button class="btn btn-primary" id="create-entity-btn">+ Create Entity</button>
                </div>
                <div class="entities-grid">
                    ${entitiesHtml}
                </div>
            </div>
            <div class="context-menu" id="entity-context-menu">
                <div class="context-menu-item" data-action="edit">Edit</div>
                <div class="context-menu-item danger" data-action="delete">Delete</div>
            </div>
        `;

        // Attach event handlers after rendering
        this.attachCreateButtonHandler();
        this.attachCardClickHandlers();
        this.attachContextMenuHandlers();
    }

    private renderEntityCard(entity: Entity): string {
        const entries = this.store.getEntriesByEntityId(entity.id);
        const entryCount = entries.length;
        const selectedId = this.store.getSelectedEntityId();
        const isSelected = selectedId === entity.id;

        return `
            <div class="entity-card ${isSelected ? 'selected' : ''}" data-entity-id="${entity.id}">
                <h3>${escapeHtml(entity.name)}</h3>
                <span class="entity-type ${entity.type.toLowerCase()}">${entity.type}</span>
                ${entity.categories.length > 0 ? `
                    <div class="entity-categories">
                        ${entity.categories.map(cat => `<span class="category-tag">${escapeHtml(cat)}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="entity-stats">
                    <span class="entry-count">${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}</span>
                </div>
            </div>
        `;
    }

    private attachCreateButtonHandler(): void {
        const createBtn = this.querySelector('#create-entity-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                this.openEntityFormPanel();
            });
        }
    }

    private openEntityFormPanel(): void {
        const panel = document.querySelector('slide-up-panel');
        const formTemplate = document.querySelector('#entity-upsert-form-template');

        if (panel && formTemplate) {
            // Clone the form to get a fresh instance
            const formClone = formTemplate.cloneNode(true) as HTMLElement;
            formClone.removeAttribute('id');
            formClone.style.display = 'block';

            // Set to create mode
            const upsertForm = formClone as any;
            if (upsertForm && typeof upsertForm.setCreateMode === 'function') {
                upsertForm.setCreateMode();
            }

            (panel as any).open('Create New Entity', formClone);
        }
    }

    private attachCardClickHandlers(): void {
        this.querySelectorAll('.entity-card').forEach(card => {
            card.addEventListener('click', () => {
                const entityId = (card as HTMLElement).dataset.entityId;
                if (entityId) {
                    this.store.setSelectedEntityId(entityId);

                    // Switch to entries tab
                    const appTabs = document.querySelector('app-tabs');
                    if (appTabs && typeof (appTabs as any).switchTab === 'function') {
                        (appTabs as any).switchTab('entries');
                    }
                }
            });
        });
    }

    private handleDelete(entityId: string): void {
        const entity = this.store.getEntityById(entityId);
        if (!entity) return;

        if (!confirm(`Are you sure you want to delete "${entity.name}"? All related entries will also be deleted.`)) {
            return;
        }

        try {
            this.store.deleteEntity(entityId);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            alert(`Error deleting entity: ${message}`);
        }
    }

    private attachContextMenuHandlers(): void {
        this.contextMenu = this.querySelector('#entity-context-menu');

        // Add right-click listeners to entity cards
        this.querySelectorAll('.entity-card').forEach(card => {
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const entityId = (card as HTMLElement).dataset.entityId;
                if (entityId) {
                    this.showContextMenu(e as MouseEvent, entityId);
                }
            });
        });

        // Handle menu item clicks
        if (this.contextMenu) {
            this.contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
                item.addEventListener('click', () => {
                    const action = (item as HTMLElement).dataset.action;
                    if (action && this.contextMenuEntityId) {
                        this.handleContextMenuAction(action, this.contextMenuEntityId);
                    }
                    this.hideContextMenu();
                });
            });
        }

        // Hide context menu when clicking elsewhere
        document.addEventListener('click', () => this.hideContextMenu());
        document.addEventListener('contextmenu', (e) => {
            // Only hide if not right-clicking on an entity card
            if (!(e.target as HTMLElement).closest('.entity-card')) {
                this.hideContextMenu();
            }
        });
    }

    private showContextMenu(e: MouseEvent, entityId: string): void {
        if (!this.contextMenu) return;

        this.contextMenuEntityId = entityId;
        this.contextMenu.classList.add('active');
        this.contextMenu.style.left = `${e.pageX}px`;
        this.contextMenu.style.top = `${e.pageY}px`;
    }

    private hideContextMenu(): void {
        if (this.contextMenu) {
            this.contextMenu.classList.remove('active');
        }
        this.contextMenuEntityId = null;
    }

    private handleContextMenuAction(action: string, entityId: string): void {
        if (action === 'delete') {
            this.handleDelete(entityId);
        } else if (action === 'edit') {
            this.handleEdit(entityId);
        }
    }

    private handleEdit(entityId: string): void {
        const entity = this.store.getEntityById(entityId);
        if (!entity) return;

        const panel = document.querySelector('slide-up-panel');
        const formTemplate = document.querySelector('#entity-upsert-form-template');

        if (panel && formTemplate) {
            // Clone the form to get a fresh instance
            const formClone = formTemplate.cloneNode(true) as HTMLElement;
            formClone.removeAttribute('id');
            formClone.style.display = 'block';

            // Set to edit mode
            const upsertForm = formClone as any;
            if (upsertForm && typeof upsertForm.setEditMode === 'function') {
                upsertForm.setEditMode(entityId);
            }

            (panel as any).open('Edit Entity', formClone);
        }
    }
}
