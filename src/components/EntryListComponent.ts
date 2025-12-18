import { WebComponent } from './WebComponent.js';
import { Entry } from '../models/Entry.js';
import { escapeHtml, formatDate } from '../utils/helpers.js';

/**
 * EntryList Web Component for displaying recent entries
 */
export class EntryListComponent extends WebComponent {
    private maxEntries: number = 20;

    render(): void {
        const selectedEntityId = this.store.getSelectedEntityId();
        let entries = this.store.getEntries();

        // Filter entries by selected entity if one is selected
        if (selectedEntityId) {
            entries = entries.filter(e => e.entityId === selectedEntityId);
        }

        // Get selected entity name for header
        const selectedEntity = selectedEntityId ? this.store.getEntityById(selectedEntityId) : null;
        const headerText = selectedEntity
            ? `Entries for ${selectedEntity.name}`
            : 'Recent Entries';

        if (entries.length === 0) {
            const emptyMessage = selectedEntity
                ? `No entries yet for ${selectedEntity.name}. Log your first entry!`
                : 'No entries yet. Log your first entry!';

            this.innerHTML = `
                <div class="section">
                    <div class="section-header">
                        <h2>${headerText}</h2>
                        <button class="btn btn-primary" id="log-entry-btn">+ Log Entry</button>
                    </div>
                    <div class="empty-state">${emptyMessage}</div>
                </div>
            `;
            this.attachLogEntryButtonHandler();
            return;
        }

        const entriesHtml = entries
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, this.maxEntries)
            .map(entry => this.renderEntryCard(entry))
            .join('');

        this.innerHTML = `
            <div class="section">
                <div class="section-header">
                    <h2>${headerText}</h2>
                    <button class="btn btn-primary" id="log-entry-btn">+ Log Entry</button>
                </div>
                <div class="entries-list">
                    ${entriesHtml}
                </div>
            </div>
        `;

        // Attach event handlers after rendering
        this.attachLogEntryButtonHandler();
        this.attachDeleteHandlers();
    }

    private renderEntryCard(entry: Entry): string {
        return `
            <div class="entry-card">
                <div class="entry-header">
                    <span class="entry-entity-name">${escapeHtml(entry.entityName)}</span>
                    <span class="entry-timestamp">${formatDate(entry.timestamp)}</span>
                </div>
                ${entry.notes ? `<div class="entry-notes">${escapeHtml(entry.notes)}</div>` : ''}
                <div class="entity-actions">
                    <button class="btn btn-danger btn-sm" data-entry-id="${entry.id}" data-action="delete">Delete</button>
                </div>
            </div>
        `;
    }

    private attachLogEntryButtonHandler(): void {
        const logEntryBtn = this.querySelector('#log-entry-btn');
        if (logEntryBtn) {
            logEntryBtn.addEventListener('click', () => {
                this.openEntryFormPanel();
            });
        }
    }

    private openEntryFormPanel(): void {
        const panel = document.querySelector('slide-up-panel');
        const formTemplate = document.querySelector('#entry-form-template');

        if (panel && formTemplate) {
            // Clone the form to get a fresh instance
            const formClone = formTemplate.cloneNode(true) as HTMLElement;
            formClone.removeAttribute('id');
            formClone.style.display = 'block';

            (panel as any).open('Log New Entry', formClone);
        }
    }

    private attachDeleteHandlers(): void {
        this.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const entryId = target.dataset.entryId;
                if (entryId) {
                    this.handleDelete(entryId);
                }
            });
        });
    }

    private handleDelete(entryId: string): void {
        if (!confirm('Are you sure you want to delete this entry?')) {
            return;
        }

        try {
            this.store.deleteEntry(entryId);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            alert(`Error deleting entry: ${message}`);
        }
    }
}
