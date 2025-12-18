import { WebComponent } from './WebComponent.js';
import { Entity } from '../models/Entity.js';
import { EntityFormData, EntityType } from '../types/index.js';

/**
 * EntityUpsertForm Web Component for creating or updating entities
 * Handles both create (when no entityId) and update (when entityId provided)
 */
export class EntityUpsertFormComponent extends WebComponent {
    private entityId: string | null = null;
    private entity: Entity | null = null;
    private isEditMode: boolean = false;

    connectedCallback(): void {
        // Don't auto-render, wait for setEntity() or just render for create
    }

    // For create mode - no parameters
    setCreateMode(): void {
        this.isEditMode = false;
        this.entityId = null;
        this.entity = null;
        this.render();
        this.attachEventListeners();
    }

    // For edit mode - provide entityId
    setEditMode(entityId: string): void {
        this.entityId = entityId;
        const foundEntity = this.store.getEntityById(entityId);
        if (foundEntity) {
            this.isEditMode = true;
            this.entity = foundEntity;
            this.render();
            this.attachEventListeners();
        }
    }

    render(): void {
        const buttonText = this.isEditMode ? 'Update Entity' : 'Create Entity';

        // For edit mode, combine name with hashtags
        let nameValue = '';
        if (this.isEditMode && this.entity) {
            nameValue = this.entity.categories.length > 0
                ? `${this.entity.name} ${this.entity.categories.map(c => `#${c}`).join(' ')}`
                : this.entity.name;
        }

        const typeValue = this.isEditMode && this.entity ? this.entity.type : '';

        this.innerHTML = `
            <form id="entity-upsert-form">
                <div class="form-group">
                    <label for="entity-name">Name *</label>
                    <input type="text" id="entity-name" value="${nameValue}" placeholder="e.g., Morning Run #health #fitness" required>
                    <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px; display: block;">Use #hashtags to add categories</small>
                </div>

                <div class="form-group">
                    <label for="entity-type">Type *</label>
                    <select id="entity-type" required>
                        <option value="">Select type...</option>
                        <option value="Habit" ${typeValue === 'Habit' ? 'selected' : ''}>Habit</option>
                        <option value="Task" ${typeValue === 'Task' ? 'selected' : ''}>Task</option>
                        <option value="Expense" ${typeValue === 'Expense' ? 'selected' : ''}>Expense</option>
                        <option value="Mood" ${typeValue === 'Mood' ? 'selected' : ''}>Mood</option>
                        <option value="Node" ${typeValue === 'Node' ? 'selected' : ''}>Node</option>
                    </select>
                </div>

                <button type="submit" class="btn btn-primary">${buttonText}</button>
            </form>
        `;
    }

    protected attachEventListeners(): void {
        const form = this.querySelector('#entity-upsert-form') as HTMLFormElement;
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }
    }

    private handleSubmit(e: Event): void {
        e.preventDefault();

        try {
            const nameInput = this.querySelector('#entity-name') as HTMLInputElement;
            let name = nameInput.value;

            // Extract hashtags (words starting with #)
            const hashtagRegex = /#(\w+)/g;
            const hashtags: string[] = [];
            let match;

            while ((match = hashtagRegex.exec(name)) !== null) {
                hashtags.push(match[1]); // Extract without the # symbol
            }

            // Remove hashtags from name
            name = name.replace(/#\w+/g, '').trim();

            const formData: EntityFormData = {
                name: name,
                type: (this.querySelector('#entity-type') as HTMLSelectElement).value as EntityType,
                categories: hashtags.join(', ')
            };

            if (this.isEditMode && this.entityId) {
                // Update existing entity
                this.store.updateEntity(this.entityId, {
                    name: formData.name,
                    type: formData.type,
                    categories: hashtags
                });
            } else {
                // Create new entity
                const entity = Entity.fromFormData(formData);
                this.store.addEntity(entity);
            }

            // Close the panel
            const panel = document.querySelector('slide-up-panel');
            if (panel && typeof (panel as any).close === 'function') {
                (panel as any).close();
            }

            // Reset form
            (e.target as HTMLFormElement).reset();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            const action = this.isEditMode ? 'updating' : 'creating';
            alert(`Error ${action} entity: ${message}`);
        }
    }
}
