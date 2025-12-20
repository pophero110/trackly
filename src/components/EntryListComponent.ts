import { WebComponent } from './WebComponent.js';
import { Entry } from '../models/Entry.js';
import { escapeHtml, formatDate } from '../utils/helpers.js';
import { URLStateManager } from '../utils/urlState.js';
import { EntityProperty } from '../types/index.js';

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
                    ${selectedEntity ? '<button class="btn-back" id="back-to-grid">← Back</button>' : ''}
                    <div class="section-header">
                        <h2>${headerText}</h2>
                        <button class="btn btn-primary" id="log-entry-btn">+ Log Entry</button>
                    </div>
                    <div class="empty-state">${emptyMessage}</div>
                </div>
            `;
            this.attachLogEntryButtonHandler();
            this.attachBackButtonHandler();
            return;
        }

        const entriesHtml = entries
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, this.maxEntries)
            .map(entry => this.renderEntryCard(entry))
            .join('');

        this.innerHTML = `
            <div class="section">
                ${selectedEntity ? '<button class="btn-back" id="back-to-grid">← Back</button>' : ''}
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
        this.attachBackButtonHandler();
        this.attachDeleteHandlers();
        this.attachCardClickHandlers();
    }

    private renderEntryCard(entry: Entry): string {
        const entity = this.store.getEntityById(entry.entityId);
        const valueHtml = entry.value !== undefined ? `<div class="entry-value">${this.formatValue(entry.value, entry.valueDisplay, entity?.valueType)}</div>` : '';
        const notesHtml = entry.notes ? `<div class="entry-notes">${this.formatNotes(entry.notes)}</div>` : '';

        // Render custom properties
        const propertiesHtml = entity && entity.properties && entity.properties.length > 0 && entry.propertyValues
            ? this.renderPropertyValues(entity.properties, entry.propertyValues, entry.propertyValueDisplays)
            : '';

        const imagesHtml = entry.images && entry.images.length > 0 ? `
            <div class="entry-images">
                ${entry.images.map(img => `<img src="${img}" alt="Entry image" class="entry-image">`).join('')}
            </div>
        ` : '';

        return `
            <div class="entry-card" data-entry-id="${entry.id}" style="cursor: pointer;">
                <div class="entry-header">
                    <span class="entry-timestamp">${formatDate(entry.timestamp)}</span>
                    <button class="btn btn-danger btn-sm" data-entry-id="${entry.id}" data-action="delete">Delete</button>
                </div>
                ${valueHtml}
                ${propertiesHtml}
                ${notesHtml}
                ${imagesHtml}
            </div>
        `;
    }

    private renderPropertyValues(properties: EntityProperty[], propertyValues: Record<string, string | number | boolean>, propertyValueDisplays?: Record<string, string>): string {
        const propertyItems = properties
            .filter(prop => propertyValues[prop.id] !== undefined && propertyValues[prop.id] !== '')
            .map(prop => {
                const value = propertyValues[prop.id];
                const displayValue = propertyValueDisplays?.[prop.id];
                const formattedValue = this.formatPropertyValue(value, prop.valueType, displayValue);
                return `
                    <div class="property-value-item">
                        <span class="property-label">${escapeHtml(prop.name)}:</span>
                        <span class="property-value">${formattedValue}</span>
                    </div>
                `;
            })
            .join('');

        if (!propertyItems) return '';

        return `<div class="entry-properties">${propertyItems}</div>`;
    }

    private formatPropertyValue(value: string | number | boolean, valueType: string, displayValue?: string): string {
        const valueStr = String(value);

        // Handle different value types
        if (valueType === 'checkbox') {
            return value === true || value === 'true' ? '✓ Yes' : '✗ No';
        }

        if (valueType === 'url') {
            // Use displayValue (fetched title) if available, otherwise show URL
            const linkText = displayValue || valueStr;
            return `<a href="${escapeHtml(valueStr)}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">${escapeHtml(linkText)}</a>`;
        }

        if (valueType === 'duration') {
            return `${valueStr} minutes`;
        }

        if (valueType === 'rating') {
            return `${valueStr}/5`;
        }

        if (valueType === 'date' || valueType === 'time') {
            return escapeHtml(valueStr);
        }

        // Default: escape and return
        return escapeHtml(valueStr);
    }

    private formatNotes(notes: string): string {
        let formattedNotes = escapeHtml(notes);

        // First, convert [[title::url]] format to clickable links with titles
        const titleUrlRegex = /\[\[([^\]]+?)::(.+?)\]\]/g;
        formattedNotes = formattedNotes.replace(titleUrlRegex, (_match, title, url) => {
            // Unescape the parts that were escaped by escapeHtml
            const unescapedUrl = url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
            const unescapedTitle = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
            return `<a href="${unescapedUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">${unescapedTitle}</a>`;
        });

        // Then, convert any remaining raw URLs to clickable links (for backwards compatibility)
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        formattedNotes = formattedNotes.replace(urlRegex, (url) => {
            // Skip if this URL is already part of a link (check if preceded by href=")
            if (formattedNotes.includes(`href="${url}"`)) {
                return url;
            }
            // Unescape the URL that was escaped by escapeHtml
            const unescapedUrl = url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
            return `<a href="${unescapedUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">${url}</a>`;
        });

        return formattedNotes;
    }

    private formatValue(value: string | number | boolean, displayValue?: string, valueType?: string): string {
        const valueStr = String(value);

        // Check if it's a URL for media types
        if (valueStr.startsWith('http://') || valueStr.startsWith('https://')) {
            // Image
            if (valueStr.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) {
                return `<img src="${escapeHtml(valueStr)}" alt="Entry image" style="max-width: 100%; border-radius: 4px; margin-top: 4px;">`;
            }
            // Audio
            if (valueStr.match(/\.(mp3|wav|ogg|m4a)(\?|$)/i)) {
                return `<audio controls style="width: 100%; margin-top: 4px;"><source src="${escapeHtml(valueStr)}"></audio>`;
            }
            // Video
            if (valueStr.match(/\.(mp4|webm|ogv)(\?|$)/i)) {
                return `<video controls style="max-width: 100%; border-radius: 4px; margin-top: 4px;"><source src="${escapeHtml(valueStr)}"></video>`;
            }
            // Hyperlink - use displayValue if available
            const linkText = displayValue || valueStr;
            return `<a href="${escapeHtml(valueStr)}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">${escapeHtml(linkText)}</a>`;
        }

        // Check if value contains [[title::url]] format (for text values with fetched titles)
        if (valueStr.includes('[[') && valueStr.includes('::')) {
            return this.formatNotes(valueStr);
        }

        // Check if it's a select option value (e.g., task status, decision, goal, plan)
        if (valueStr === 'todo' || valueStr === 'in-progress' || valueStr === 'done' || valueStr === 'yes' || valueStr === 'no' || valueStr === 'pending' || valueStr === 'not-started' || valueStr === 'completed' || valueStr === 'draft' || valueStr === 'active' || valueStr === 'on-hold') {
            let displayText = valueStr;
            if (valueStr === 'in-progress') displayText = 'In Progress';
            else if (valueStr === 'todo') displayText = 'To Do';
            else if (valueStr === 'done') displayText = 'Done';
            else if (valueStr === 'yes') displayText = 'Yes';
            else if (valueStr === 'no') displayText = 'No';
            else if (valueStr === 'pending') displayText = 'Pending';
            else if (valueStr === 'not-started') displayText = 'Not Started';
            else if (valueStr === 'completed') displayText = 'Completed';
            else if (valueStr === 'draft') displayText = 'Draft';
            else if (valueStr === 'active') displayText = 'Active';
            else if (valueStr === 'on-hold') displayText = 'On Hold';
            return `<span class="status-badge ${valueStr}">${displayText}</span>`;
        }

        // Check if it's a boolean/checkbox value
        if (valueStr === 'true' || valueStr === 'false') {
            return valueStr === 'true' ? '✓ Yes' : '✗ No';
        }

        // Check if it's a color value
        if (valueStr.match(/^#[0-9A-Fa-f]{6}$/)) {
            return `<div style="display: inline-flex; align-items: center; gap: 8px;"><div style="width: 24px; height: 24px; background: ${valueStr}; border: 1px solid #ccc; border-radius: 4px;"></div><span>${valueStr}</span></div>`;
        }

        // Check if it's a date/time value (ISO format)
        if (valueStr.match(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/)) {
            try {
                const date = new Date(valueStr);
                if (!isNaN(date.getTime())) {
                    return date.toLocaleString();
                }
            } catch {
                // Not a valid date, fall through
            }
        }

        // Add units for numeric value types
        if (valueType) {
            const numValue = Number(valueStr);
            if (!isNaN(numValue)) {
                if (valueType === 'duration') {
                    return `${valueStr} minutes`;
                } else if (valueType === 'rating') {
                    return `${valueStr}/5`;
                }
            }
        }

        return escapeHtml(valueStr);
    }

    private attachLogEntryButtonHandler(): void {
        const logEntryBtn = this.querySelector('#log-entry-btn');
        if (logEntryBtn) {
            logEntryBtn.addEventListener('click', () => {
                this.openEntryFormPanel();
            });
        }
    }

    private attachBackButtonHandler(): void {
        const backBtn = this.querySelector('#back-to-grid');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.showEntityGrid();
            });
        }
    }

    private showEntityGrid(): void {
        URLStateManager.showGrid();
    }

    private openEntryFormPanel(): void {
        const selectedEntityId = this.store.getSelectedEntityId();
        const entity = selectedEntityId ? this.store.getEntityById(selectedEntityId) : null;

        URLStateManager.openLogEntryPanel(entity?.name);
    }

    private attachCardClickHandlers(): void {
        this.querySelectorAll('.entry-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                // Don't trigger if clicking on delete button
                if (target.closest('[data-action="delete"]')) {
                    return;
                }
                // Don't trigger if clicking on a link
                if (target.tagName === 'A' || target.closest('a')) {
                    return;
                }

                const entryId = (card as HTMLElement).dataset.entryId;
                if (entryId) {
                    URLStateManager.openEditEntryPanel(entryId);
                }
            });
        });
    }

    private attachDeleteHandlers(): void {
        this.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click
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
