import { WebComponent } from './WebComponent.js';
import { Entity } from '../models/Entity.js';
import { escapeHtml } from '../utils/helpers.js';

/**
 * EntityList Web Component for displaying all entities
 */
export class EntityListComponent extends WebComponent {
    render(): void {
        const entities = this.store.getEntities();

        if (entities.length === 0) {
            this.innerHTML = `
                <div class="sidebar-header">
                    <h2>Entities</h2>
                </div>
                <div class="empty-state-sidebar">No entities yet</div>
            `;
            return;
        }

        const entitiesHtml = entities
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map(entity => this.renderEntityCard(entity))
            .join('');

        this.innerHTML = `
            <div class="sidebar-header">
                <h2>Entities</h2>
            </div>
            <div class="sidebar-entities">
                ${entitiesHtml}
            </div>
        `;

        // Attach event handlers after rendering
        this.attachDeleteHandlers();
        this.attachCardClickHandlers();
    }

    private renderEntityCard(entity: Entity): string {
        const selectedId = this.store.getSelectedEntityId();
        const isSelected = selectedId === entity.id;

        return `
            <div class="sidebar-entity-card ${isSelected ? 'selected' : ''}" data-entity-id="${entity.id}">
                <div class="sidebar-entity-header">
                    <h3>${escapeHtml(entity.name)}</h3>
                    <button class="btn-icon-delete" data-action="delete" title="Delete">×</button>
                </div>
                <span class="entity-type ${entity.type.toLowerCase()}">${entity.type}</span>
                ${entity.categories.length > 0 ? `
                    <div class="entity-categories">
                        ${entity.categories.map(cat => `<span class="category-tag">${escapeHtml(cat)}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    private attachDeleteHandlers(): void {
        this.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click
                const target = e.target as HTMLElement;
                const card = target.closest('.sidebar-entity-card') as HTMLElement;
                const entityId = card?.dataset.entityId;
                if (entityId) {
                    this.handleDelete(entityId);
                }
            });
        });
    }

    private attachCardClickHandlers(): void {
        this.querySelectorAll('.sidebar-entity-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                // Don't trigger if clicking delete button
                if (target.closest('.btn-icon-delete')) {
                    return;
                }

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
}
