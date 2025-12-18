import { WebComponent } from './WebComponent.js';
import { Entry } from '../models/Entry.js';
import { EntryFormData } from '../types/index.js';
import { getCurrentTimestamp, escapeHtml } from '../utils/helpers.js';

/**
 * EntryForm Web Component for logging new entries
 */
export class EntryFormComponent extends WebComponent {
    render(): void {
        const entities = this.store.getEntities();
        const selectedEntityId = this.store.getSelectedEntityId();

        const entitiesOptions = entities
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(entity => `<option value="${entity.id}" ${entity.id === selectedEntityId ? 'selected' : ''}>${escapeHtml(entity.name)} (${entity.type})</option>`)
            .join('');

        this.innerHTML = `
            <form id="entry-form">
                <div class="form-group">
                    <label for="entry-entity">Select Entity *</label>
                    <select id="entry-entity" required>
                        <option value="">Select entity...</option>
                        ${entitiesOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label for="entry-timestamp">Timestamp *</label>
                    <input type="datetime-local" id="entry-timestamp" value="${getCurrentTimestamp()}" required>
                </div>

                <div class="form-group">
                    <label for="entry-notes">Notes (optional)</label>
                    <textarea id="entry-notes" rows="3"></textarea>
                </div>

                <button type="submit" class="btn btn-primary">Log Entry</button>
            </form>
        `;

        this.attachEventListeners();
    }

    protected attachEventListeners(): void {
        const form = this.querySelector('#entry-form') as HTMLFormElement;
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }
    }

    private handleSubmit(e: Event): void {
        e.preventDefault();

        try {
            const entityId = (this.querySelector('#entry-entity') as HTMLSelectElement).value;
            const entity = this.store.getEntityById(entityId);

            if (!entity) {
                throw new Error('Please select a valid entity');
            }

            const formData: EntryFormData = {
                timestamp: (this.querySelector('#entry-timestamp') as HTMLInputElement).value,
                notes: (this.querySelector('#entry-notes') as HTMLTextAreaElement).value
            };

            const entry = Entry.fromFormData(formData, entity);
            this.store.addEntry(entry);

            // Close the panel
            const panel = document.querySelector('slide-up-panel');
            if (panel && typeof (panel as any).close === 'function') {
                (panel as any).close();
            }

            // Reset form
            (e.target as HTMLFormElement).reset();
            (this.querySelector('#entry-timestamp') as HTMLInputElement).value = getCurrentTimestamp();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            alert(`Error logging entry: ${message}`);
        }
    }
}
