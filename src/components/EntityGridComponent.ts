import { WebComponent } from './WebComponent.js';
import { Entity } from '../models/Entity.js';
import { escapeHtml, formatDate } from '../utils/helpers.js';
import { URLStateManager } from '../utils/urlState.js';
import { EntityProperty } from '../types/index.js';

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
        this.attachExpandButtonHandlers();
        this.attachCardClickHandlers();
        this.attachContextMenuHandlers();
    }

    private renderEntityCard(entity: Entity): string {
        const entries = this.store.getEntriesByEntityId(entity.id);
        const selectedId = this.store.getSelectedEntityId();
        const isSelected = selectedId === entity.id;

        // Get most recent entry
        const sortedEntries = entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const mostRecentEntry = sortedEntries.length > 0 ? sortedEntries[0] : null;

        return `
            <div class="entity-card ${isSelected ? 'selected' : ''}" data-entity-id="${entity.id}">
                <button class="btn-expand-card" data-action="expand" title="View all entries">→</button>
                <div class="entity-metadata">
                    <div class="entity-card-header">
                        <h3>${escapeHtml(entity.name)}</h3>
                    </div>
                    <span class="entity-type ${entity.type.toLowerCase()}">${entity.type}</span>
                    ${entity.categories.length > 0 ? `
                        <div class="entity-categories">
                            ${entity.categories.map(cat => `<span class="category-tag">${escapeHtml(cat)}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
                ${mostRecentEntry ? `
                    <div class="entity-recent-entry">
                        <div class="recent-entry-timestamp">${formatDate(mostRecentEntry.timestamp)}</div>
                        ${mostRecentEntry.value !== undefined ? `<div class="recent-entry-value">${this.formatValue(mostRecentEntry.value, mostRecentEntry.valueDisplay, entity.valueType)}</div>` : ''}
                        ${entity.properties && entity.properties.length > 0 && mostRecentEntry.propertyValues ? this.renderPropertyValues(entity.properties, mostRecentEntry.propertyValues, mostRecentEntry.propertyValueDisplays) : ''}
                        ${mostRecentEntry.notes ? `<div class="recent-entry-notes">${this.formatNotes(mostRecentEntry.notes)}</div>` : ''}
                    </div>
                ` : ''}
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
                    <div class="property-value-item-compact">
                        <span class="property-label-compact">${escapeHtml(prop.name)}:</span>
                        <span class="property-value-compact">${formattedValue}</span>
                    </div>
                `;
            })
            .join('');

        if (!propertyItems) return '';

        return `<div class="entity-properties-compact">${propertyItems}</div>`;
    }

    private formatPropertyValue(value: string | number | boolean, valueType: string, displayValue?: string): string {
        const valueStr = String(value);

        // Handle different value types
        if (valueType === 'checkbox') {
            return value === true || value === 'true' ? '✓' : '✗';
        }

        if (valueType === 'url') {
            // Use displayValue (fetched title) if available, otherwise use URL
            // Truncate long titles/URLs for grid display
            const linkText = displayValue || valueStr;
            const truncatedText = linkText.length > 25 ? linkText.substring(0, 25) + '...' : linkText;
            return `<a href="${escapeHtml(valueStr)}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">${escapeHtml(truncatedText)}</a>`;
        }

        if (valueType === 'duration') {
            return `${valueStr} min`;
        }

        if (valueType === 'rating') {
            return `${valueStr}/5`;
        }

        if (valueType === 'date' || valueType === 'time') {
            return escapeHtml(valueStr);
        }

        // Default: escape and truncate if too long
        const displayText = valueStr.length > 30 ? valueStr.substring(0, 30) + '...' : valueStr;
        return escapeHtml(displayText);
    }

    private formatNotes(notes: string): string {
        let formattedNotes = escapeHtml(notes);

        // Convert [[title::url]] format to clickable links with titles (truncated for grid)
        const titleUrlRegex = /\[\[([^\]]+?)::(.+?)\]\]/g;
        formattedNotes = formattedNotes.replace(titleUrlRegex, (_match, title, url) => {
            const unescapedUrl = url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
            const unescapedTitle = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
            // Truncate title for grid display
            const displayTitle = unescapedTitle.length > 30 ? unescapedTitle.substring(0, 30) + '...' : unescapedTitle;
            return `<a href="${unescapedUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">${displayTitle}</a>`;
        });

        // Convert remaining raw URLs (backwards compatibility)
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        formattedNotes = formattedNotes.replace(urlRegex, (url) => {
            if (formattedNotes.includes(`href="${url}"`)) {
                return url;
            }
            const unescapedUrl = url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
            // Show truncated URL for grid
            const displayUrl = url.length > 30 ? url.substring(0, 30) + '...' : url;
            return `<a href="${unescapedUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">${displayUrl}</a>`;
        });

        return formattedNotes;
    }

    private formatValue(value: string | number | boolean, displayValue?: string, valueType?: string): string {
        const valueStr = String(value);

        // For entity cards, show simplified version for media
        if (valueStr.startsWith('http://') || valueStr.startsWith('https://')) {
            // Image - show thumbnail
            if (valueStr.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) {
                return `<img src="${escapeHtml(valueStr)}" alt="Preview" style="max-width: 100px; max-height: 60px; border-radius: 4px; object-fit: cover;">`;
            }
            // Audio/Video - show icon
            if (valueStr.match(/\.(mp3|wav|ogg|m4a|mp4|webm|ogv)(\?|$)/i)) {
                return '🎵 Media';
            }
            // Hyperlink - use displayValue if available, otherwise show hostname
            let linkText: string;
            if (displayValue) {
                linkText = displayValue.length > 40 ? displayValue.substring(0, 40) + '...' : displayValue;
            } else {
                const urlObj = new URL(valueStr);
                linkText = urlObj.hostname;
            }
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
            return valueStr === 'true' ? '✓' : '✗';
        }

        // Check if it's a color value
        if (valueStr.match(/^#[0-9A-Fa-f]{6}$/)) {
            return `<div style="width: 20px; height: 20px; background: ${valueStr}; border: 1px solid #ccc; border-radius: 4px;"></div>`;
        }

        // Check if it's a date/time value (ISO format) - show shortened version for grid
        if (valueStr.match(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/)) {
            try {
                const date = new Date(valueStr);
                if (!isNaN(date.getTime())) {
                    return date.toLocaleDateString();
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
                    return `${valueStr} min`;
                } else if (valueType === 'rating') {
                    return `${valueStr}/5`;
                }
            }
        }

        return escapeHtml(valueStr);
    }

    private attachCreateButtonHandler(): void {
        const createBtn = this.querySelector('#create-entity-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                URLStateManager.openCreateEntityPanel();
            });
        }
    }

    private attachExpandButtonHandlers(): void {
        this.querySelectorAll('.btn-expand-card[data-action="expand"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click
                const card = (e.target as HTMLElement).closest('.entity-card') as HTMLElement;
                const entityId = card?.dataset.entityId;
                if (entityId) {
                    const entity = this.store.getEntityById(entityId);
                    if (entity) {
                        URLStateManager.showEntryList(entity.name);
                    }
                }
            });
        });
    }

    private attachCardClickHandlers(): void {
        this.querySelectorAll('.entity-card').forEach(card => {
            card.addEventListener('click', () => {
                const entityId = (card as HTMLElement).dataset.entityId;
                if (entityId) {
                    const entity = this.store.getEntityById(entityId);
                    if (entity) {
                        URLStateManager.openLogEntryPanel(entity.name);
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

        URLStateManager.openEditEntityPanel(entity.name);
    }
}
