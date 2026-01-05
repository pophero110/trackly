import { WebComponent } from './WebComponent.js';
import { Entry } from '../models/Entry.js';
import { escapeHtml, formatDate, extractHashtags } from '../utils/helpers.js';
import { parseMarkdown } from '../utils/markdown.js';
import { URLStateManager } from '../utils/urlState.js';
import { EntityProperty } from '../types/index.js';
import { getEntityColor } from '../utils/entryHelpers.js';
import { toast } from '../utils/toast.js';

/**
 * EntryList Web Component for displaying recent entries
 */
export class EntryListComponent extends WebComponent {
    private maxEntries: number = 20;
    private resizeObserver: ResizeObserver | null = null;

    render(): void {
        // Show loading state while data is being fetched
        if (!this.store.getIsLoaded()) {
            const entryIcon = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
                </svg>
            `;

            this.innerHTML = `
                <div class="section">
                    <div class="section-header-strong">
                        <div class="section-header-content">
                            <div class="section-header-text">
                                <h2 class="section-title">${entryIcon}Entries</h2>
                                <p class="section-subtitle">Your activity log</p>
                            </div>
                        </div>
                    </div>
                    ${this.renderLoadingState('Loading entries...')}
                </div>
            `;
            return;
        }

        const selectedEntityId = this.store.getSelectedEntityId();
        let entries = this.store.getEntries();

        // Filter entries by selected entity if one is selected
        if (selectedEntityId) {
            entries = entries.filter(e => e.entityId === selectedEntityId);
        }

        // Filter entries by entities if any are selected (multi-entity filter)
        const entityFilters = URLStateManager.getEntityFilters();
        if (entityFilters.length > 0 && !selectedEntityId) {
            entries = entries.filter(e => {
                const entity = this.store.getEntityById(e.entityId);
                if (!entity) return false;
                // Entry must match one of the selected entities (OR logic)
                return entityFilters.some(filterName =>
                    entity.name.toLowerCase() === filterName.toLowerCase()
                );
            });
        }

        // Filter entries by tags if any are selected (multi-tag filter)
        const tagFilters = URLStateManager.getTagFilters();
        if (tagFilters.length > 0) {
            entries = entries.filter(e => {
                if (!e.notes) return false;
                const entryTags = extractHashtags(e.notes);
                // Entry must have ALL selected tags (AND logic)
                return tagFilters.every(tag =>
                    entryTags.some(entryTag => entryTag.toLowerCase() === tag.toLowerCase())
                );
            });
        }

        // Legacy: Filter entries by single hashtag (backwards compatibility)
        const hashtagFilter = URLStateManager.getHashtagFilter();
        if (hashtagFilter && tagFilters.length === 0) {
            entries = entries.filter(e => {
                if (!e.notes) return false;
                const hashtagRegex = new RegExp(`#${hashtagFilter}\\b`, 'i');
                return hashtagRegex.test(e.notes);
            });
        }

        // Get selected entity name for header
        const selectedEntity = selectedEntityId ? this.store.getEntityById(selectedEntityId) : null;

        // Entry icon for "Your Entries" header
        const entryIcon = !selectedEntity ? `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
            </svg>
        ` : '';

        const headerText = selectedEntity
            ? `${selectedEntity.name}`
            : `${entryIcon}Entries`;

        const entityTypeAndCategories = selectedEntity
            ? `<span class="entity-type ${selectedEntity.type.toLowerCase()}">${selectedEntity.type}</span>${selectedEntity.categories.length > 0 ? selectedEntity.categories.map(cat => `<span class="entity-category-chip">${escapeHtml(cat)}</span>`).join('') : ''}`
            : '';

        // Hashtag filter badge
        const hashtagBadge = hashtagFilter
            ? `<span class="hashtag-filter-badge">#${hashtagFilter} <button class="clear-hashtag" data-action="clear-hashtag">×</button></span>`
            : '';

        // Get current sort values from URL
        const currentSortBy = URLStateManager.getSortBy() || 'timestamp';
        const currentSortOrder = URLStateManager.getSortOrder() || 'desc';

        // Get all available tags from all entries
        const allEntries = this.store.getEntries();
        const allTags = new Set<string>();
        allEntries.forEach(entry => {
            if (entry.notes) {
                extractHashtags(entry.notes).forEach(tag => allTags.add(tag));
            }
        });
        const availableTags = Array.from(allTags).sort();

        // Tag filter button with chips
        const selectedTagChips = tagFilters.length > 0 ? tagFilters.map(tag => `
            <span class="tag-chip-inline">#${escapeHtml(tag)}</span>
        `).join('') : '';

        // Always show icon on mobile, show chips on desktop
        const tagIcon = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
            </svg>
        `;
        const tagButtonLabel = tagFilters.length > 0 ? `${tagIcon}${selectedTagChips}` : tagIcon;

        // Tag filter dropdown
        const tagFilterDropdown = availableTags.length > 0 ? `
            <div class="tag-filter-container">
                <button class="btn-tag-filter ${tagFilters.length > 0 ? 'has-filters' : ''}"
                        id="tag-filter-btn"
                        title="Filter by tags"
                        ${tagFilters.length > 0 ? `data-filter-count="${tagFilters.length}"` : ''}>
                    ${tagButtonLabel}
                </button>
                <div class="tag-filter-menu" id="tag-filter-menu" style="display: none;">
                    ${availableTags.map(tag => `
                        <label class="tag-filter-option">
                            <input type="checkbox" value="${escapeHtml(tag)}" ${tagFilters.includes(tag) ? 'checked' : ''}>
                            <span>#${escapeHtml(tag)}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        ` : '';

        // Get all available entities
        const allEntities = this.store.getEntities();
        const availableEntities = allEntities.sort((a, b) => a.name.localeCompare(b.name));

        // Entity filter button with chips
        const selectedEntityChips = entityFilters.length > 0 ? entityFilters.map(entity => `
            <span class="tag-chip-inline">${escapeHtml(entity)}</span>
        `).join('') : '';

        // Always show icon on mobile, show chips on desktop
        const entityIcon = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
        `;
        const entityButtonLabel = entityFilters.length > 0 ? `${entityIcon}${selectedEntityChips}` : entityIcon;

        // Entity filter dropdown (only show on "all entries" view, not on entity-specific view)
        const entityFilterDropdown = !selectedEntityId && availableEntities.length > 0 ? `
            <div class="tag-filter-container">
                <button class="btn-tag-filter ${entityFilters.length > 0 ? 'has-filters' : ''}"
                        id="entity-filter-btn"
                        title="Filter by entities"
                        ${entityFilters.length > 0 ? `data-filter-count="${entityFilters.length}"` : ''}>
                    ${entityButtonLabel}
                </button>
                <div class="tag-filter-menu" id="entity-filter-menu" style="display: none;">
                    ${availableEntities.map(entity => `
                        <label class="tag-filter-option">
                            <input type="checkbox" value="${escapeHtml(entity.name)}" ${entityFilters.includes(entity.name) ? 'checked' : ''}>
                            <span>${escapeHtml(entity.name)}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        ` : '';

        // Sort options
        const sortOptions = [
            { value: 'timestamp-desc', label: 'Newest First' },
            { value: 'timestamp-asc', label: 'Oldest First' },
            { value: 'createdAt-desc', label: 'Recently Created' },
            { value: 'createdAt-asc', label: 'Oldest Created' },
            { value: 'entityName-asc', label: 'Entity (A-Z)' },
            { value: 'entityName-desc', label: 'Entity (Z-A)' }
        ];

        const currentSortValue = `${currentSortBy}-${currentSortOrder}`;
        const currentSortLabel = sortOptions.find(opt => opt.value === currentSortValue)?.label || 'Newest First';

        // Sort select dropdown
        const sortSelect = `
            <div class="tag-filter-container">
                <button class="btn-tag-filter" id="sort-filter-btn" title="Sort by">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="4" y1="6" x2="11" y2="6"></line>
                        <line x1="4" y1="12" x2="16" y2="12"></line>
                        <line x1="4" y1="18" x2="20" y2="18"></line>
                    </svg>
                    <span>${currentSortLabel}</span>
                </button>
                <div class="tag-filter-menu" id="sort-filter-menu" style="display: none;">
                    ${sortOptions.map(opt => `
                        <label class="tag-filter-option">
                            <input type="radio" name="sort-option" value="${opt.value}" ${opt.value === currentSortValue ? 'checked' : ''}>
                            <span>${escapeHtml(opt.label)}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;

        if (entries.length === 0) {
            const emptyMessage = selectedEntity
                ? `No entries yet for ${selectedEntity.name}. Log your first entry!`
                : 'No entries yet. Log your first entry!';

            const subtitle = selectedEntity
                ? `Capture ${selectedEntity.name.toLowerCase()} moments`
                : 'Your activity log';

            // Entity menu (only show when viewing a specific entity)
            const entityMenu = selectedEntity ? `
                <button class="entry-menu-btn" id="entity-page-menu-btn" data-entity-id="${selectedEntity.id}" data-action="menu">⋮</button>
                <div class="entity-context-menu" id="entity-page-menu" style="display: none;">
                    <div class="context-menu-item" data-entity-id="${selectedEntity.id}" data-action="edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        <span>Edit</span>
                    </div>
                    <div class="context-menu-item" data-entity-id="${selectedEntity.id}" data-action="clone">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Clone</span>
                    </div>
                    <div class="context-menu-item danger" data-entity-id="${selectedEntity.id}" data-action="delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        <span>Delete</span>
                    </div>
                </div>
            ` : '';

            this.innerHTML = `
                <div class="section">
                    <div class="section-header-strong">
                        <div class="section-header-content">
                            <div class="section-header-text">
                                <h2 class="section-title">${headerText} ${entityTypeAndCategories}</h2>
                                <p class="section-subtitle">${subtitle}</p>
                            </div>
                            <div class="section-header-actions">
                                ${sortSelect}
                                ${entityFilterDropdown}
                                ${tagFilterDropdown}
                                ${hashtagBadge}
                                <button class="btn btn-primary btn-add-entry" id="log-entry-btn">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                    Add Entry
                                </button>
                                ${entityMenu}
                            </div>
                        </div>
                    </div>
                    <div class="empty-state">${emptyMessage}</div>
                </div>
            `;
            this.attachLogEntryButtonHandler();
            this.attachHashtagClearHandler();
            this.attachEntityPageMenuHandlers();
            this.attachSortHandler();
            this.attachEntityFilterHandlers();
            this.attachTagFilterHandlers();
            return;
        }

        const entriesHtml = entries
            .slice(0, this.maxEntries)
            .map(entry => this.renderEntryCard(entry))
            .join('');

        const subtitle = selectedEntity
            ? `Capture ${selectedEntity.name.toLowerCase()} moments`
            : 'Your activity log';

        // Entity menu (only show when viewing a specific entity)
        const entityMenu = selectedEntity ? `
            <button class="entry-menu-btn" id="entity-page-menu-btn" data-entity-id="${selectedEntity.id}" data-action="menu">⋮</button>
            <div class="entity-context-menu" id="entity-page-menu" style="display: none;">
                <div class="context-menu-item" data-entity-id="${selectedEntity.id}" data-action="edit">Edit</div>
                <div class="context-menu-item" data-entity-id="${selectedEntity.id}" data-action="clone">Clone</div>
                <div class="context-menu-item danger" data-entity-id="${selectedEntity.id}" data-action="delete">Delete</div>
            </div>
        ` : '';

        this.innerHTML = `
            <div class="section">
                <div class="section-header-strong">
                    <div class="section-header-content">
                        <div class="section-header-text">
                            <h2 class="section-title">${headerText} ${entityTypeAndCategories}</h2>
                            <p class="section-subtitle">${subtitle}</p>
                        </div>
                        <div class="section-header-actions">
                            ${sortSelect}
                            ${entityFilterDropdown}
                            ${tagFilterDropdown}
                            ${hashtagBadge}
                            <button class="btn-primary btn-add-entry" id="log-entry-btn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Add Entry
                            </button>
                            ${entityMenu}
                        </div>
                    </div>
                </div>
                <div class="entries-list page-grid scrollable-grid">
                    ${entriesHtml}
                </div>
            </div>
        `;

        // Attach event handlers after rendering
        this.attachSortHandler();
        this.attachEntityFilterHandlers();
        this.attachTagFilterHandlers();
        this.attachLogEntryButtonHandler();
        this.attachMenuHandlers();
        this.attachCardClickHandlers();
        this.attachHashtagHandlers();
        this.attachHashtagClearHandler();
        this.attachEntityChipHandlers();
        this.attachEntityPageMenuHandlers();
        this.detectTruncatedContent();
        this.setupResizeObserver();
    }

    private detectTruncatedContent(): void {
        // Check each entry-content div to see if it's truncated
        this.querySelectorAll('.entry-content').forEach(contentEl => {
            const element = contentEl as HTMLElement;
            // Check if content height exceeds max-height
            if (element.scrollHeight > element.clientHeight) {
                element.classList.add('is-truncated');
            } else {
                element.classList.remove('is-truncated');
            }
        });
    }

    private setupResizeObserver(): void {
        // Clean up existing observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        // Create new observer to detect when cards resize
        this.resizeObserver = new ResizeObserver(() => {
            this.detectTruncatedContent();
        });

        // Observe all entry cards
        this.querySelectorAll('.entry-card').forEach(card => {
            this.resizeObserver!.observe(card as HTMLElement);
        });
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        // Clean up resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
    }

    private renderEntryCard(entry: Entry): string {
        const entity = this.store.getEntityById(entry.entityId);

        // Get entity type icon/emoji
        const typeIcon = this.getEntityTypeIcon(entity?.type);

        // Entry title (value) - now primary and prominent
        const entryTitle = entry.value !== undefined
            ? `<h3 class="entry-title-primary">${typeIcon} ${this.formatValue(entry.value, entry.valueDisplay, entity?.valueType)}</h3>`
            : '';

        // Notes content
        const notesHtml = entry.notes ? `<div class="entry-notes">${this.formatNotes(entry.notes)}</div>` : '';

        // Extract hashtags from notes
        const hashtags = entry.notes ? extractHashtags(entry.notes) : [];
        const hashtagChips = hashtags.length > 0
            ? hashtags.map(tag => `<span class="entry-chip entry-chip-tag" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</span>`).join('')
            : '';

        // Entity name as chip with color
        const entityColor = entity ? getEntityColor(entity.name) : '';
        const entityChip = entity ? `<span class="entry-chip entry-chip-entity" data-entity-name="${escapeHtml(entity.name)}" style="--entity-color: ${entityColor}">${escapeHtml(entity.name)}</span>` : '';

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

        // Location display (inline in header with separator)
        const locationHeaderHtml = entry.latitude && entry.longitude
            ? `<span class="metadata-separator">•</span>
            <span class="entry-location-header">
                <span class="location-icon-small">📍</span>
                <a href="https://www.google.com/maps?q=${entry.latitude},${entry.longitude}"
                   target="_blank"
                   rel="noopener noreferrer"
                   class="location-link-header"
                   title="Click to open in Google Maps">
                    ${entry.locationName || `${entry.latitude.toFixed(4)}, ${entry.longitude.toFixed(4)}`}
                </a>
            </span>`
            : '';

        return `
            <div class="entry-card" data-entry-id="${entry.id}">
                <div class="entry-card-header">
                    <div class="entry-header-left">
                        ${entityChip}
                        <span class="entry-timestamp-secondary">🕒 ${formatDate(entry.timestamp)}</span>
                        ${locationHeaderHtml}
                    </div>
                    <button class="entry-menu-btn" data-entry-id="${entry.id}" data-action="menu">⋮</button>
                </div>
                ${propertiesHtml ? `<div class="entry-card-properties">${propertiesHtml}</div>` : ''}
                <div class="entry-card-content">
                    ${entryTitle}
                    ${hasContent ? `<div class="entry-content">${notesHtml}</div>` : ''}
                    ${hashtagChips ? `<div class="entry-tags">${hashtagChips}</div>` : ''}
                    ${hasAttachments ? `<div class="entry-attachments">${imagesHtml}</div>` : ''}
                </div>
            </div>
            <div class="entry-context-menu" id="entry-menu-${entry.id}" style="display: none;">
                <div class="context-menu-item" data-entry-id="${entry.id}" data-action="edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    <span>Edit</span>
                </div>
                <div class="context-menu-item" data-entry-id="${entry.id}" data-action="archive">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="21 8 21 21 3 21 3 8"></polyline>
                        <rect x="1" y="3" width="22" height="5"></rect>
                        <line x1="10" y1="12" x2="14" y2="12"></line>
                    </svg>
                    <span>Archive</span>
                </div>
                <div class="context-menu-item danger" data-entry-id="${entry.id}" data-action="delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    <span>Delete</span>
                </div>
            </div>
        `;
    }

    private getEntityTypeIcon(type?: string): string {
        if (!type) return '●';

        const icons: Record<string, string> = {
            'Habit': '🎯',
            'Task': '✓',
            'Event': '📅',
            'Note': '📝',
            'Expense': '💰',
            'Mood': '😊',
            'Exercise': '💪',
            'Meal': '🍽️',
            'Sleep': '😴',
            'Reading': '📚',
            'Movie': '🎬',
            'Goal': '🎯',
            'Journal': '📔',
            'Idea': '💡',
            'Link': '🔗'
        };

        return icons[type] || '●';
    }

    private renderPropertyValues(properties: EntityProperty[], propertyValues: Record<string, string | number | boolean>, propertyValueDisplays?: Record<string, string>): string {
        const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

        const propertyItems = properties
            .filter(prop => propertyValues[prop.id] !== undefined && propertyValues[prop.id] !== '')
            .map(prop => {
                const value = propertyValues[prop.id];
                const displayValue = propertyValueDisplays?.[prop.id];
                const formattedValue = this.formatPropertyValue(value, prop.valueType, displayValue);
                // For URL properties, show just the link without the property name
                if (prop.valueType === 'url') {
                    return `<span class="property-tag">${formattedValue}</span>`;
                }
                return `<span class="property-tag">${escapeHtml(capitalizeFirstLetter(prop.name))}: ${formattedValue}</span>`;
            })
            .join('<span class="property-separator">•</span>');

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
        return parseMarkdown(notes);
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


    private openEntryFormPanel(): void {
        const selectedEntityId = this.store.getSelectedEntityId();
        const entity = selectedEntityId ? this.store.getEntityById(selectedEntityId) : null;

        URLStateManager.openLogEntryPanel(entity?.name);
    }

    private attachSortHandler(): void {
        // Toggle sort filter menu
        const filterBtn = this.querySelector('#sort-filter-btn');
        const filterMenu = this.querySelector('#sort-filter-menu') as HTMLElement;

        if (filterBtn && filterMenu) {
            // Toggle menu on button click
            filterBtn.addEventListener('click', () => {
                const isVisible = filterMenu.style.display === 'block';
                filterMenu.style.display = isVisible ? 'none' : 'block';
            });

            // Handle sort option selection
            const radioButtons = filterMenu.querySelectorAll('input[type="radio"]');
            radioButtons.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    const value = (e.target as HTMLInputElement).value;
                    const [sortBy, sortOrder] = value.split('-') as [string, 'asc' | 'desc'];
                    // Update URL - this will trigger updateView() which will reload entries
                    URLStateManager.setSort(sortBy, sortOrder);
                    // Close the menu after selection
                    filterMenu.style.display = 'none';
                });
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!filterMenu.contains(e.target as Node) && !filterBtn.contains(e.target as Node)) {
                    filterMenu.style.display = 'none';
                }
            });
        }
    }

    private attachCardClickHandlers(): void {
        this.querySelectorAll('.entry-card').forEach(card => {
            let longPressTimer: number | null = null;
            let touchStartX = 0;
            let touchStartY = 0;
            let longPressTriggered = false;

            // Touch start - begin long press detection
            card.addEventListener('touchstart', (e) => {
                const target = e.target as HTMLElement;

                // Don't trigger long press on menu button, links, or hashtags
                if (target.closest('[data-action="menu"]') ||
                    target.tagName === 'A' ||
                    target.closest('a') ||
                    target.closest('.hashtag-link')) {
                    return;
                }

                const touch = (e as TouchEvent).touches[0];
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                longPressTriggered = false;

                // Start long press timer (500ms)
                longPressTimer = window.setTimeout(() => {
                    const entryId = (card as HTMLElement).dataset.entryId;
                    if (entryId) {
                        longPressTriggered = true;
                        // Trigger haptic feedback if available
                        if ('vibrate' in navigator) {
                            navigator.vibrate(50);
                        }
                        // Show context menu at touch position
                        // Pass coordinates directly to menu positioning
                        this.showMenuAtPosition(entryId, touchStartX, touchStartY);
                    }
                }, 500);
            });

            // Touch move - cancel if moved too much
            card.addEventListener('touchmove', (e) => {
                if (longPressTimer) {
                    const touch = (e as TouchEvent).touches[0];
                    const moveX = Math.abs(touch.clientX - touchStartX);
                    const moveY = Math.abs(touch.clientY - touchStartY);

                    // Cancel if moved more than 10px
                    if (moveX > 10 || moveY > 10) {
                        window.clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                }
            });

            // Touch end - cancel timer
            card.addEventListener('touchend', () => {
                if (longPressTimer) {
                    window.clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            });

            // Touch cancel - cancel timer
            card.addEventListener('touchcancel', () => {
                if (longPressTimer) {
                    window.clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            });

            // Regular click to navigate to detail page
            card.addEventListener('click', (e) => {
                // Don't navigate if long press was just triggered
                if (longPressTriggered) {
                    longPressTriggered = false;
                    return;
                }

                const target = e.target as HTMLElement;

                // Don't navigate if clicking on menu button
                if (target.closest('[data-action="menu"]')) {
                    return;
                }

                // Don't navigate if clicking on a link
                if (target.tagName === 'A' || target.closest('a')) {
                    return;
                }

                // Don't navigate if clicking on hashtag
                if (target.closest('.hashtag-link')) {
                    return;
                }

                const entryId = (card as HTMLElement).dataset.entryId;
                if (entryId) {
                    URLStateManager.showEntryDetail(entryId);
                }
            });

            // Right-click to show context menu
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
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
                    this.toggleMenu(entryId, e as MouseEvent);
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
                // Find the menu item (in case user clicked on icon or span)
                const menuItem = target.closest('.context-menu-item') as HTMLElement;
                if (!menuItem) return;

                const entryId = menuItem.dataset.entryId;
                const action = menuItem.dataset.action;

                if (entryId && action) {
                    if (action === 'edit') {
                        URLStateManager.openEditEntryPanel(entryId);
                    } else if (action === 'archive') {
                        this.handleArchive(entryId);
                    } else if (action === 'delete') {
                        this.handleDelete(entryId);
                    }
                }
                this.hideAllMenus();
            });
        });

        // Click/touch outside to close menus
        const closeMenusHandler = (e: Event) => {
            const target = e.target as HTMLElement;
            // Don't close if clicking inside a menu or on a menu button
            if (target.closest('.entry-context-menu') || target.closest('[data-action="menu"]')) {
                return;
            }
            this.hideAllMenus();
        };

        document.addEventListener('click', closeMenusHandler);
        document.addEventListener('touchstart', closeMenusHandler);
    }

    private toggleMenu(entryId: string, e: MouseEvent, customX?: number, customY?: number): void {
        const menu = this.querySelector(`#entry-menu-${entryId}`) as HTMLElement;
        if (!menu) return;

        // Hide all other menus first
        this.hideAllMenus();

        // Position and show this menu
        menu.style.display = 'block';
        menu.style.position = 'fixed';

        // Check if event came from menu button click
        const target = e.target as HTMLElement;
        const menuButton = target.closest('[data-action="menu"]') as HTMLElement;

        if (menuButton) {
            // Menu button click - align menu's right edge with button's right edge
            const rect = menuButton.getBoundingClientRect();

            // Temporarily show menu to get its dimensions
            menu.style.visibility = 'hidden';
            const menuWidth = menu.offsetWidth;
            menu.style.visibility = 'visible';

            menu.style.left = `${rect.right - menuWidth}px`;
            menu.style.top = `${rect.bottom + 4}px`;
        } else {
            // Right-click or long-press - show at cursor/touch position
            // Use custom coordinates if provided (from long-press), otherwise use event coordinates
            const x = customX !== undefined ? customX : (e.clientX || 0);
            const y = customY !== undefined ? customY : (e.clientY || 0);

            // Get menu dimensions (it's already display:block from above)
            const menuWidth = menu.offsetWidth;
            const menuHeight = menu.offsetHeight;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let left = x;
            let top = y;

            // Adjust if menu would go off right edge
            if (left + menuWidth > viewportWidth) {
                left = Math.max(8, viewportWidth - menuWidth - 8);
            }

            // Adjust if menu would go off bottom edge
            if (top + menuHeight > viewportHeight) {
                top = Math.max(8, viewportHeight - menuHeight - 8);
            }

            menu.style.left = `${left}px`;
            menu.style.top = `${top}px`;
        }
    }

    private showMenuAtPosition(entryId: string, x: number, y: number): void {
        const menu = this.querySelector(`#entry-menu-${entryId}`) as HTMLElement;
        if (!menu) return;

        // Hide all other menus first
        this.hideAllMenus();

        // Position and show this menu
        menu.style.display = 'block';
        menu.style.position = 'fixed';

        // Get menu dimensions
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Align right edge of menu with touch position
        let left = x - menuWidth;
        let top = y;

        // Adjust if menu would go off left edge
        if (left < 8) {
            left = 8;
        }

        // Adjust if menu would go off right edge
        if (left + menuWidth > viewportWidth - 8) {
            left = viewportWidth - menuWidth - 8;
        }

        // Adjust if menu would go off bottom edge
        if (top + menuHeight > viewportHeight) {
            top = Math.max(8, viewportHeight - menuHeight - 8);
        }

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
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
            const deleteIcon = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
            `;
            toast.show({ message: 'Entry deleted successfully', type: 'success', customIcon: deleteIcon });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            toast.error(`Error deleting entry: ${message}`);
        }
    }

    private async handleArchive(entryId: string): Promise<void> {
        try {
            await this.store.archiveEntry(entryId, true);
            const archiveIcon = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="21 8 21 21 3 21 3 8"></polyline>
                    <rect x="1" y="3" width="22" height="5"></rect>
                    <line x1="10" y1="12" x2="14" y2="12"></line>
                </svg>
            `;
            toast.show({ message: 'Entry archived successfully', type: 'success', customIcon: archiveIcon });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            toast.error(`Error archiving entry: ${message}`);
        }
    }

    private attachHashtagHandlers(): void {
        // Handle hashtags in notes (clickable hashtags within formatted text)
        this.querySelectorAll('.hashtag').forEach(hashtag => {
            hashtag.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const target = e.target as HTMLElement;
                const tag = target.dataset.tag;
                if (tag) {
                    URLStateManager.addTagFilter(tag);
                }
            });
        });

        // Handle hashtag chips in entry-tags section
        this.querySelectorAll('.entry-chip-tag').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const target = e.target as HTMLElement;
                const tag = target.dataset.tag;
                if (tag) {
                    URLStateManager.addTagFilter(tag);
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

    private attachEntityFilterHandlers(): void {
        // Toggle entity filter menu
        const filterBtn = this.querySelector('#entity-filter-btn');
        const filterMenu = this.querySelector('#entity-filter-menu') as HTMLElement;

        if (filterBtn && filterMenu) {
            filterBtn.addEventListener('click', () => {
                const isVisible = filterMenu.style.display === 'block';
                filterMenu.style.display = isVisible ? 'none' : 'block';
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!filterMenu.contains(e.target as Node) && !filterBtn.contains(e.target as Node)) {
                    filterMenu.style.display = 'none';
                }
            });

            // Handle checkbox changes
            const checkboxes = filterMenu.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const target = e.target as HTMLInputElement;
                    const entityName = target.value;

                    if (target.checked) {
                        URLStateManager.addEntityFilter(entityName);
                    } else {
                        URLStateManager.removeEntityFilter(entityName);
                    }
                });
            });
        }
    }

    private attachTagFilterHandlers(): void {
        // Toggle tag filter menu
        const filterBtn = this.querySelector('#tag-filter-btn');
        const filterMenu = this.querySelector('#tag-filter-menu') as HTMLElement;

        if (filterBtn && filterMenu) {
            filterBtn.addEventListener('click', () => {
                const isVisible = filterMenu.style.display === 'block';
                filterMenu.style.display = isVisible ? 'none' : 'block';
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!filterMenu.contains(e.target as Node) && !filterBtn.contains(e.target as Node)) {
                    filterMenu.style.display = 'none';
                }
            });

            // Handle checkbox changes
            const checkboxes = filterMenu.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const target = e.target as HTMLInputElement;
                    const tag = target.value;

                    if (target.checked) {
                        URLStateManager.addTagFilter(tag);
                    } else {
                        URLStateManager.removeTagFilter(tag);
                    }
                });
            });
        }
    }

    private attachEntityChipHandlers(): void {
        this.querySelectorAll('.entry-chip-entity').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                const entityName = (chip as HTMLElement).dataset.entityName;
                if (entityName) {
                    URLStateManager.showEntryList(entityName);
                }
            });
        });
    }

    private attachEntityPageMenuHandlers(): void {
        const menuBtn = this.querySelector('#entity-page-menu-btn');
        if (!menuBtn) return;

        // Menu button click
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleEntityPageMenu(e as MouseEvent);
        });

        // Menu item clicks
        this.querySelectorAll('#entity-page-menu .context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                // Find the menu item (in case user clicked on icon or span)
                const menuItem = target.closest('.context-menu-item') as HTMLElement;
                if (!menuItem) return;

                const entityId = menuItem.dataset.entityId;
                const action = menuItem.dataset.action;

                if (entityId && action) {
                    this.handleEntityPageMenuAction(action, entityId);
                }
                this.hideEntityPageMenu();
            });
        });

        // Click outside to close menu
        document.addEventListener('click', () => this.hideEntityPageMenu());
    }

    private toggleEntityPageMenu(e: MouseEvent): void {
        const menu = this.querySelector('#entity-page-menu') as HTMLElement;
        if (!menu) return;

        const isVisible = menu.style.display === 'block';

        if (isVisible) {
            this.hideEntityPageMenu();
            return;
        }

        // Show menu
        menu.style.display = 'block';
        menu.style.position = 'fixed';

        const target = e.target as HTMLElement;
        const menuButton = target.closest('#entity-page-menu-btn') as HTMLElement;

        if (menuButton) {
            const rect = menuButton.getBoundingClientRect();

            // Temporarily show menu to get its dimensions
            menu.style.visibility = 'hidden';
            const menuWidth = menu.offsetWidth;
            menu.style.visibility = 'visible';

            menu.style.left = `${rect.right - menuWidth}px`;
            menu.style.top = `${rect.bottom + 4}px`;
        }
    }

    private hideEntityPageMenu(): void {
        const menu = this.querySelector('#entity-page-menu') as HTMLElement;
        if (menu) {
            menu.style.display = 'none';
        }
    }

    private handleEntityPageMenuAction(action: string, entityId: string): void {
        if (action === 'delete') {
            this.handleEntityDelete(entityId);
        } else if (action === 'edit') {
            this.handleEntityEdit(entityId);
        } else if (action === 'clone') {
            this.handleEntityClone(entityId);
        }
    }

    private handleEntityDelete(entityId: string): void {
        const entity = this.store.getEntityById(entityId);
        if (!entity) return;

        if (!confirm(`Are you sure you want to delete "${entity.name}"? All entries associated with this entity will also be deleted.`)) {
            return;
        }

        try {
            this.store.deleteEntity(entityId);
            // Navigate back to home after delete
            URLStateManager.showHome();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            alert(`Error deleting entity: ${message}`);
        }
    }

    private handleEntityEdit(entityId: string): void {
        const entity = this.store.getEntityById(entityId);
        if (!entity) return;
        URLStateManager.openEditEntityPanel(entity.name);
    }

    private handleEntityClone(entityId: string): void {
        const entity = this.store.getEntityById(entityId);
        if (!entity) return;
        URLStateManager.openCloneEntityPanel(entity.name);
    }
}
