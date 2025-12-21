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

        // Filter entries by hashtag if one is selected
        const hashtagFilter = URLStateManager.getHashtagFilter();
        if (hashtagFilter) {
            entries = entries.filter(e => {
                if (!e.notes) return false;
                const hashtagRegex = new RegExp(`#${hashtagFilter}\\b`, 'i');
                return hashtagRegex.test(e.notes);
            });
        }

        // Get selected entity name for header
        const selectedEntity = selectedEntityId ? this.store.getEntityById(selectedEntityId) : null;
        const headerText = selectedEntity
            ? `${selectedEntity.name}`
            : 'Recent Entries';
        const entityType = selectedEntity ? `<span class="entity-type ${selectedEntity.type.toLowerCase()}">${selectedEntity.type}</span>` : '';

        // Hashtag filter badge
        const hashtagBadge = hashtagFilter
            ? `<span class="hashtag-filter-badge">#${hashtagFilter} <button class="clear-hashtag" data-action="clear-hashtag">×</button></span>`
            : '';

        if (entries.length === 0) {
            const emptyMessage = selectedEntity
                ? `No entries yet for ${selectedEntity.name}. Log your first entry!`
                : 'No entries yet. Log your first entry!';

            this.innerHTML = `
                <div class="section">
                    ${selectedEntity ? '<button class="btn-back" id="back-to-grid">← Back</button>' : ''}
                    <div class="section-header">
                        <div class="section-header-title">
                            <h2>${headerText}</h2>
                            ${entityType}
                            ${hashtagBadge}
                        </div>
                        <button class="btn btn-primary" id="log-entry-btn">+ Log Entry</button>
                    </div>
                    <div class="empty-state">${emptyMessage}</div>
                </div>
            `;
            this.attachLogEntryButtonHandler();
            this.attachBackButtonHandler();
            this.attachHashtagClearHandler();
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
                    <div class="section-header-title">
                        <h2>${headerText}</h2>
                        ${entityType}
                        ${hashtagBadge}
                    </div>
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
        this.attachMenuHandlers();
        this.attachCardClickHandlers();
        this.attachHashtagHandlers();
        this.attachHashtagClearHandler();
    }

    private renderEntryCard(entry: Entry): string {
        const entity = this.store.getEntityById(entry.entityId);

        // Entry title (value)
        const entryTitle = entry.value !== undefined
            ? `<div class="entry-title">${this.formatValue(entry.value, entry.valueDisplay, entity?.valueType)}</div>`
            : '';

        // Notes content
        const notesHtml = entry.notes ? `<div class="entry-notes">${this.formatNotes(entry.notes)}</div>` : '';

        // Extract URLs for reference section
        const referencesHtml = entry.notes ? this.renderReferences(entry.notes) : '';

        // Render custom properties
        const propertiesHtml = entity && entity.properties && entity.properties.length > 0 && entry.propertyValues
            ? this.renderPropertyValues(entity.properties, entry.propertyValues, entry.propertyValueDisplays)
            : '';

        // Image attachments with media card styling
        const imagesHtml = entry.images && entry.images.length > 0 ? `
            <div class="entry-media-grid">
                ${entry.images.map(img => `
                    <div class="entry-media-card">
                        <img src="${img}" alt="Entry image" class="entry-media-image">
                    </div>
                `).join('')}
            </div>
        ` : '';

        const hasContent = notesHtml;
        const hasAttachments = imagesHtml;
        const hasReferences = referencesHtml;

        return `
            <div class="entry-card" data-entry-id="${entry.id}">
                <div class="entry-metadata">
                    <div class="entry-header">
                        <span class="entry-timestamp">${formatDate(entry.timestamp)}</span>
                        <button class="entry-menu-btn" data-entry-id="${entry.id}" data-action="menu">⋮</button>
                    </div>
                    ${entryTitle}
                    ${propertiesHtml}
                </div>
                ${hasContent ? `
                    <div class="entry-content">
                        ${notesHtml}
                    </div>
                ` : ''}
                ${hasReferences ? `
                    <div class="entry-references">
                        ${referencesHtml}
                    </div>
                ` : ''}
                ${hasAttachments ? `
                    <div class="entry-attachments">
                        ${imagesHtml}
                    </div>
                ` : ''}
            </div>
            <div class="entry-context-menu" id="entry-menu-${entry.id}" style="display: none;">
                <div class="context-menu-item" data-entry-id="${entry.id}" data-action="edit">Edit</div>
                <div class="context-menu-item danger" data-entry-id="${entry.id}" data-action="delete">Delete</div>
            </div>
        `;
    }

    private renderReferences(notes: string): string {
        const urls: Array<{title: string, url: string}> = [];

        // Extract markdown links [title](url)
        const markdownRegex = /\[([^\]]+?)\]\((.+?)\)/g;
        let match;
        while ((match = markdownRegex.exec(notes)) !== null) {
            urls.push({ title: match[1], url: match[2] });
        }

        if (urls.length === 0) {
            return '';
        }

        const referenceLinks = urls.map(({title, url}) => {
            const escapedTitle = escapeHtml(title);
            const escapedUrl = escapeHtml(url);
            return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="reference-link">${escapedTitle}</a>`;
        }).join('');

        return referenceLinks;
    }

    private renderPropertyValues(properties: EntityProperty[], propertyValues: Record<string, string | number | boolean>, propertyValueDisplays?: Record<string, string>): string {
        const propertyItems = properties
            .filter(prop => propertyValues[prop.id] !== undefined && propertyValues[prop.id] !== '')
            .map(prop => {
                const value = propertyValues[prop.id];
                const displayValue = propertyValueDisplays?.[prop.id];
                const formattedValue = this.formatPropertyValue(value, prop.valueType, displayValue);
                return `<span class="property-tag">${escapeHtml(prop.name)}: ${formattedValue}</span>`;
            })
            .join('');

        if (!propertyItems) return '';

        return `<div class="entry-properties">${propertyItems}</div>`;
    }

    private formatPropertyValue(value: string | number | boolean, valueType: string, displayValue?: string): string {
        const valueStr = String(value);

        // Handle different value types
        if (valueType === 'checkbox') {
            return value === true || value === 'true' ? '✓' : '✗';
        }

        if (valueType === 'url') {
            // Use displayValue (fetched title) if available, otherwise show URL
            const linkText = displayValue || valueStr;
            return `<a href="${escapeHtml(valueStr)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`;
        }

        if (valueType === 'duration') {
            return `${valueStr}min`;
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
        // Step 1: Extract and store markdown link patterns with placeholders
        const linkPatterns: Array<{placeholder: string, html: string}> = [];

        // Extract markdown links [title](url)
        let tempNotes = notes.replace(/\[([^\]]+?)\]\((.+?)\)/g, (_match, title, url) => {
            const placeholder = `___LINK_${linkPatterns.length}___`;
            linkPatterns.push({
                placeholder,
                html: `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">${title}</a>`
            });
            return placeholder;
        });

        // Step 2: Escape HTML
        let formattedNotes = escapeHtml(tempNotes);

        // Step 3: Convert newlines to <br> tags
        formattedNotes = formattedNotes.replace(/\n/g, '<br>');

        // Step 4: Convert hashtags to clickable filter links (but not in URLs)
        // Match hashtags that are NOT preceded by :/ (to avoid matching URL fragments)
        const hashtagRegex = /(?<!:\/[^\s]*)(^|\s)#([a-zA-Z0-9_]+)/g;
        formattedNotes = formattedNotes.replace(hashtagRegex, (_match, whitespace, tag) => {
            return `${whitespace}<a href="#" class="hashtag" data-tag="${tag}" style="color: var(--primary); text-decoration: none; font-weight: 500;">#${tag}</a>`;
        });

        // Step 5: Restore link patterns
        linkPatterns.forEach(({placeholder, html}) => {
            formattedNotes = formattedNotes.replace(placeholder, html);
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

                // Don't trigger if clicking on menu button
                if (target.closest('[data-action="menu"]')) {
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

    private attachMenuHandlers(): void {
        // Menu button click
        this.querySelectorAll('[data-action="menu"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const target = e.target as HTMLElement;
                const entryId = target.dataset.entryId;
                if (entryId) {
                    this.toggleMenu(entryId, e as MouseEvent);
                }
            });
        });

        // Menu item clicks
        this.querySelectorAll('.entry-context-menu .context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const entryId = target.dataset.entryId;
                const action = target.dataset.action;

                if (entryId && action) {
                    if (action === 'edit') {
                        URLStateManager.openEditEntryPanel(entryId);
                    } else if (action === 'delete') {
                        this.handleDelete(entryId);
                    }
                }
                this.hideAllMenus();
            });
        });

        // Click outside to close menus
        document.addEventListener('click', () => this.hideAllMenus());
    }

    private toggleMenu(entryId: string, e: MouseEvent): void {
        const menu = this.querySelector(`#entry-menu-${entryId}`) as HTMLElement;
        if (!menu) return;

        // Hide all other menus first
        this.hideAllMenus();

        // Position and show this menu
        menu.style.display = 'block';
        menu.style.position = 'absolute';
        menu.style.left = `${e.pageX - 120}px`;
        menu.style.top = `${e.pageY + 5}px`;
    }

    private hideAllMenus(): void {
        this.querySelectorAll('.entry-context-menu').forEach(menu => {
            (menu as HTMLElement).style.display = 'none';
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

    private attachHashtagHandlers(): void {
        this.querySelectorAll('.hashtag').forEach(hashtag => {
            hashtag.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const target = e.target as HTMLElement;
                const tag = target.dataset.tag;
                if (tag) {
                    URLStateManager.setHashtagFilter(tag);
                }
            });
        });
    }

    private attachHashtagClearHandler(): void {
        const clearBtn = this.querySelector('[data-action="clear-hashtag"]');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                URLStateManager.setHashtagFilter(null);
            });
        }
    }
}
