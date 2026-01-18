import { WebComponent } from './WebComponent.js';
import { Entry } from '../models/Entry.js';
import { escapeHtml, extractHashtags } from '../utils/helpers.js';
import { parseMarkdown } from '../utils/markdown.js';
import { URLStateManager } from '../utils/urlState.js';
import { EntityProperty } from '../types/index.js';
import { getEntityColor } from '../utils/entryHelpers.js';
import { toast } from '../utils/toast.js';

/**
 * Optimized EntryList Web Component
 * Focuses on stable DOM shelling, document fragments, and direct event attachment.
 */
export class EntryListComponent extends WebComponent {
  private maxEntries: number = 30;
  private resizeObserver: ResizeObserver | null = null;

  // Event listener references for cleanup
  private sortMenuCloseHandler: ((e: Event) => void) | null = null;
  private entityFilterCloseHandler: ((e: Event) => void) | null = null;
  private tagFilterCloseHandler: ((e: Event) => void) | null = null;
  private entityPageMenuCloseHandler: (() => void) | null = null;
  private entityChipDropdownCloseHandler: ((e: Event) => void) | null = null;
  private entryContextMenuCloseHandler: ((e: Event) => void) | null = null;

  // Helper to turn HTML strings into DOM nodes efficiently
  private createTemplate(html: string): DocumentFragment {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content;
  }

  render(): void {
    // 1. Stable DOM Shelling: Initialize container if it doesn't exist
    if (!this.querySelector('.section')) {
      this.innerHTML = `
        <div class="section">
          <div class="section-header-actions" id="header-actions"></div>
          <div class="entries-grid" id="entries-container"></div>
        </div>
      `;
    }

    const headerActions = this.querySelector('#header-actions') as HTMLElement;
    const entriesContainer = this.querySelector('#entries-container') as HTMLElement;

    // Loading State
    if (!this.store.getIsLoaded()) {
      entriesContainer.replaceChildren(this.createTemplate(this.renderLoadingState('Loading entries...')));
      return;
    }

    // 2. Data Preparation (Logic remains similar but decoupled from UI)
    const selectedEntityId = this.store.getSelectedEntityId();
    let entries = this.store.getEntries();

    if (selectedEntityId) {
      entries = entries.filter(e => e.entityId === selectedEntityId);
    }

    const entityFilters = URLStateManager.getEntityFilters();
    if (entityFilters.length > 0 && !selectedEntityId) {
      entries = entries.filter(e => {
        const entity = this.store.getEntityById(e.entityId);
        return entity && entityFilters.some(f => entity.name.toLowerCase() === f.toLowerCase());
      });
    }

    const tagFilters = URLStateManager.getTagFilters();
    if (tagFilters.length > 0) {
      entries = entries.filter(e => {
        if (!e.notes) return false;
        const entryTags = extractHashtags(e.notes);
        return tagFilters.every(tag => entryTags.some(et => et.toLowerCase() === tag.toLowerCase()));
      });
    }

    // 3. Targeted Header Update
    // We update the header separately to keep the dropdowns/filters responsive
    this.updateHeader(headerActions, selectedEntityId, entityFilters, tagFilters);

    // 4. Document Fragments & replaceChildren() for the List
    if (entries.length === 0) {
      const selectedEntity = selectedEntityId ? this.store.getEntityById(selectedEntityId) : null;
      const msg = selectedEntity ? `No entries yet for ${selectedEntity.name}.` : 'No entries yet.';
      const emptyStateFragment = this.createTemplate(`<div class="empty-state">${msg}</div>`);
      entriesContainer.replaceChildren(emptyStateFragment);
      return;
    }

    const fragment = document.createDocumentFragment();
    const entriesByDate = this.groupEntriesByDate(entries.slice(0, this.maxEntries));

    for (const [dateKey, dateEntries] of entriesByDate) {
      const dateGroup = document.createElement('div');
      dateGroup.className = 'timeline-date-group';
      dateGroup.innerHTML = `<div class="timeline-date-header">${dateKey}</div>`;

      const timelineEntries = document.createElement('div');
      timelineEntries.className = 'timeline-entries';

      dateEntries.forEach(entry => {
        // Create individual node and attach listeners directly
        timelineEntries.appendChild(this.createEntryNode(entry));
      });

      dateGroup.appendChild(timelineEntries);
      fragment.appendChild(dateGroup);
    }

    // Atomic swap of the entire list
    entriesContainer.replaceChildren(fragment);

    // Setup document-level click handler to close entity chip dropdowns
    this.setupEntityChipDropdownCloseHandler();
  }

  private createEntryNode(entry: Entry): DocumentFragment {
    const html = this.renderTimelineEntry(entry);
    const fragment = this.createTemplate(html);

    // Use the fragment to find elements and attach listeners before they hit the DOM
    const entryRoot = fragment.querySelector('.timeline-entry') as HTMLElement;
    const menuBtn = entryRoot.querySelector('[data-action="menu"]') as HTMLElement;
    const card = entryRoot.querySelector('.timeline-entry-card') as HTMLElement;

    // Card Click Handler
    card.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-action="menu"], a, .entry-chip-tag, .entry-chip-entity-container')) return;
      URLStateManager.showEntryDetail(entry.id);
    });

    // Menu Toggle Handler
    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Now this.querySelector will find the menu because it was appended as a sibling
        this.toggleMenu(entry.id, e as MouseEvent);
      });
    }

    // Chip Handlers
    fragment.querySelectorAll('.entry-chip-tag, .hashtag').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const tag = (el as HTMLElement).dataset.tag;
        if (tag) URLStateManager.addTagFilter(tag);
      });
    });

    // Entity Chip Dropdown Handler
    const entityContainer = fragment.querySelector('.entry-chip-entity-container');
    if (entityContainer) {
      const entityChip = entityContainer.querySelector('.entry-chip-entity') as HTMLElement;
      const entityDropdown = entityContainer.querySelector('.entity-dropdown-menu') as HTMLElement;

      if (entityChip && entityDropdown) {
        // Toggle dropdown when chip is clicked
        entityChip.addEventListener('click', (e) => {
          e.stopPropagation();

          // Close all other open dropdowns
          this.querySelectorAll('.entity-dropdown-menu').forEach(dropdown => {
            if (dropdown !== entityDropdown) {
              (dropdown as HTMLElement).style.display = 'none';
            }
          });

          // Toggle this dropdown
          if (entityDropdown.style.display === 'none') {
            entityDropdown.style.display = 'block';
          } else {
            entityDropdown.style.display = 'none';
          }
        });

        // Handle entity item clicks
        const entityItems = entityDropdown.querySelectorAll('.entity-dropdown-item');
        entityItems.forEach(item => {
          item.addEventListener('click', async (e) => {
            e.stopPropagation();
            const newEntityId = (item as HTMLElement).dataset.entityId;
            const newEntity = this.store.getEntityById(newEntityId || '');

            if (newEntity) {
              // Store original values for rollback
              const originalEntityId = entityChip.dataset.entityId;
              const originalEntityName = entityChip.dataset.entityName;
              const originalEntityColor = entityChip.style.getPropertyValue('--entity-color');

              // Optimistic update: Update UI immediately for instant feedback
              const newEntityColor = getEntityColor(newEntity.name);
              entityChip.dataset.entityId = newEntity.id;
              entityChip.dataset.entityName = newEntity.name;
              entityChip.style.setProperty('--entity-color', newEntityColor);

              // Update the text content (preserve the dropdown arrow SVG)
              const textNode = entityChip.childNodes[0];
              if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                textNode.textContent = newEntity.name;
              } else {
                // Fallback: update innerHTML but preserve the SVG
                const svg = entityChip.querySelector('svg');
                entityChip.textContent = newEntity.name;
                if (svg) entityChip.appendChild(svg);
              }

              // Hide dropdown immediately
              entityDropdown.style.display = 'none';

              try {
                // Update the entry with new entity (API call in background)
                await this.store.updateEntry(entry.id, {
                  entityId: newEntityId,
                  entityName: newEntity.name
                });
              } catch (error) {
                console.error('Error updating entry entity:', error);

                // Rollback UI on error
                if (originalEntityId) {
                  entityChip.dataset.entityId = originalEntityId;
                  entityChip.dataset.entityName = originalEntityName || '';
                  entityChip.style.setProperty('--entity-color', originalEntityColor);

                  const textNode = entityChip.childNodes[0];
                  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                    textNode.textContent = originalEntityName || '';
                  } else {
                    const svg = entityChip.querySelector('svg');
                    entityChip.textContent = originalEntityName || '';
                    if (svg) entityChip.appendChild(svg);
                  }
                }
              }
            }
          });
        });
      }
    }

    // Context Menu Action Handlers
    fragment.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = (item as HTMLElement).dataset.action;
        if (action === 'archive') this.handleArchive(entry.id);
        if (action === 'delete') this.handleDelete(entry.id);
        this.hideAllMenus();
      });
    });

    return fragment;
  }

  private updateHeader(container: HTMLElement, selectedEntityId: string | null, entityFilters: string[], tagFilters: string[]): void {
    const hashtagFilter = URLStateManager.getHashtagFilter();
    const currentSortBy = URLStateManager.getSortBy() || 'timestamp';
    const currentSortOrder = URLStateManager.getSortOrder() || 'desc';
    const currentSortValue = `${currentSortBy}-${currentSortOrder}`;

    // Use DocumentFragment instead of innerHTML
    const headerFragment = this.createTemplate(
      this.getHeaderHtml(selectedEntityId, entityFilters, tagFilters, hashtagFilter, currentSortValue)
    );
    container.replaceChildren(headerFragment);

    // 6. Integrated: attachHashtagClearHandler
    const clearBtn = container.querySelector('[data-action="clear-hashtag"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => URLStateManager.setHashtagFilter(null));
    }

    // Re-attach dropdown-specific logic
    this.attachSortHandler();
    this.attachEntityFilterHandlers();
    this.attachTagFilterHandlers();
    this.attachQuickEntryHandlers();
    this.attachEntityPageMenuHandlers();
  }

  private getHeaderHtml(
    selectedEntityId: string | null,
    entityFilters: string[],
    tagFilters: string[],
    hashtagFilter: string | null,
    currentSortValue: string
  ): string {
    // 1. Sort Options Logic
    const sortOptions = [
      { value: 'timestamp-desc', label: 'Newest First' },
      { value: 'timestamp-asc', label: 'Oldest First' },
      { value: 'createdAt-desc', label: 'Recently Created' },
      { value: 'createdAt-asc', label: 'Oldest Created' },
      { value: 'entityName-asc', label: 'Entity (A-Z)' },
      { value: 'entityName-desc', label: 'Entity (Z-A)' }
    ];
    const currentSortLabel = sortOptions.find(opt => opt.value === currentSortValue)?.label || 'Newest First';

    const sortSelect = `
      <div class="tag-filter-container">
          <button class="btn-tag-filter" id="sort-filter-btn" title="Sort by">
              <i class="ph-duotone ph-sort-ascending"></i>
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

    // 2. Entity Filter Dropdown (Logic from)
    const allEntities = this.store.getEntities();
    const availableEntities = [...allEntities].sort((a, b) => a.name.localeCompare(b.name));
    const selectedEntityChips = entityFilters.map(entity => `
        <span class="tag-chip-inline">${escapeHtml(entity)}</span>
    `).join('');

    const entityButtonLabel = entityFilters.length > 0 ? `<i class="ph-duotone ph-circles-four"></i>${selectedEntityChips}` : `<i class="ph-duotone ph-circles-four"></i>`;

    const entityFilterDropdown = !selectedEntityId && availableEntities.length > 0 ? `
      <div class="tag-filter-container">
          <button class="btn-tag-filter ${entityFilters.length > 0 ? 'has-filters' : ''}" id="entity-filter-btn" title="Filter by entities">
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

    // 3. Tag Filter Dropdown (Logic from)
    const allEntries = this.store.getEntries();
    const allTags = new Set<string>();
    allEntries.forEach(entry => {
      if (entry.notes) extractHashtags(entry.notes).forEach(tag => allTags.add(tag));
    });
    const availableTags = Array.from(allTags).sort();
    const selectedTagChips = tagFilters.map(tag => `<span class="tag-chip-inline">#${escapeHtml(tag)}</span>`).join('');
    const tagButtonLabel = tagFilters.length > 0 ? `<i class="ph-duotone ph-tag"></i>${selectedTagChips}` : `<i class="ph-duotone ph-tag"></i>`;

    const tagFilterDropdown = availableTags.length > 0 ? `
      <div class="tag-filter-container">
          <button class="btn-tag-filter ${tagFilters.length > 0 ? 'has-filters' : ''}" id="tag-filter-btn" title="Filter by tags">
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

    // 4. Legacy Hashtag and Entity Menu Logic
    const hashtagBadge = hashtagFilter ? `
      <span class="hashtag-filter-badge">#${hashtagFilter} <button class="clear-hashtag" data-action="clear-hashtag">×</button></span>
    ` : '';

    const selectedEntity = selectedEntityId ? this.store.getEntityById(selectedEntityId) : null;
    const entityMenu = selectedEntity ? `
      <button class="entry-menu-btn" id="entity-page-menu-btn" data-entity-id="${selectedEntity.id}" data-action="menu">⋮</button>
      <div class="entity-context-menu" id="entity-page-menu" style="display: none;">
          <div class="context-menu-item" data-entity-id="${selectedEntity.id}" data-action="edit"><i class="ph-duotone ph-pencil-simple"></i>Edit</div>
          <div class="context-menu-item" data-entity-id="${selectedEntity.id}" data-action="clone"><i class="ph-duotone ph-copy"></i>Clone</div>
          <div class="context-menu-item danger" data-entity-id="${selectedEntity.id}" data-action="delete"><i class="ph-duotone ph-trash"></i>Delete</div>
      </div>
    ` : '';

    // Quick entry input group - reuse existing allEntities
    const quickEntryGroup = `
      <div class="quick-entry-group">
          <input
            type="text"
            class="quick-entry-input"
            id="quick-entry-input"
            placeholder="Add a quick note..."
            autocomplete="off"
          />
      </div>
    `;

    return `
      <div class="header-quick-entry-row">
        ${quickEntryGroup}
      </div>
      <div class="header-filters-row">
        ${sortSelect}
        ${entityFilterDropdown}
        ${tagFilterDropdown}
        ${hashtagBadge}
        ${entityMenu}
      </div>
    `;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    // Clean up all document-level event listeners
    if (this.sortMenuCloseHandler) {
      document.removeEventListener('click', this.sortMenuCloseHandler);
      this.sortMenuCloseHandler = null;
    }

    if (this.entityFilterCloseHandler) {
      document.removeEventListener('click', this.entityFilterCloseHandler);
      this.entityFilterCloseHandler = null;
    }

    if (this.tagFilterCloseHandler) {
      document.removeEventListener('click', this.tagFilterCloseHandler);
      this.tagFilterCloseHandler = null;
    }

    if (this.entityPageMenuCloseHandler) {
      document.removeEventListener('click', this.entityPageMenuCloseHandler);
      this.entityPageMenuCloseHandler = null;
    }

    if (this.entityChipDropdownCloseHandler) {
      document.removeEventListener('click', this.entityChipDropdownCloseHandler);
      this.entityChipDropdownCloseHandler = null;
    }

    if (this.entryContextMenuCloseHandler) {
      document.removeEventListener('click', this.entryContextMenuCloseHandler);
      this.entryContextMenuCloseHandler = null;
    }

    // Clean up resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  private groupEntriesByDate(entries: Entry[]): Map<string, Entry[]> {
    const groups = new Map<string, Entry[]>();

    entries.forEach(entry => {
      const date = new Date(entry.timestamp);
      const dateKey = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(entry);
    });

    return groups;
  }

  private renderTimelineEntry(entry: Entry): string {
    const entity = this.store.getEntityById(entry.entityId);

    // Get entity type icon
    const typeIcon = this.getEntityTypeIcon(entity?.type);

    // Entry value - primary data point
    const entryValue = entry.value !== undefined
      ? this.formatValue(entry.value, entry.valueDisplay, entity?.valueType)
      : '';

    // Entity name chip with dropdown
    const entityColor = entity ? getEntityColor(entity.name) : '';

    // Get all entities for dropdown
    const allEntities = this.store.getEntities();
    const entitiesDropdownHtml = allEntities.map(e => {
      const color = getEntityColor(e.name);
      return `<div class="context-menu-item entity-dropdown-item" data-entity-id="${e.id}" data-entity-color="${color}">
                <span class="entity-dropdown-color" style="background: ${color};"></span>
                ${escapeHtml(e.name)}
              </div>`;
    }).join('');

    const entityChip = entity
      ? `<div class="entry-chip-entity-container" style="position: relative;" data-entry-id="${entry.id}">
           <span class="entry-chip entry-chip-entity"
                 data-entity-id="${entity.id}"
                 data-entity-name="${escapeHtml(entity.name)}"
                 style="--entity-color: ${entityColor}; cursor: pointer;">
             ${escapeHtml(entity.name)}
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 4px; vertical-align: middle;">
               <polyline points="6 9 12 15 18 9"></polyline>
             </svg>
           </span>
           <div class="entity-dropdown-menu" style="display: none;">
             ${entitiesDropdownHtml}
           </div>
         </div>`
      : '';

    // Extract hashtags from notes
    const hashtags = entry.notes ? extractHashtags(entry.notes) : [];
    const hashtagChips = hashtags.length > 0
      ? hashtags.map(tag => `<span class="entry-chip entry-chip-tag" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</span>`).join('')
      : '';

    // Render custom properties
    const propertiesHtml = entity && entity.properties && entity.properties.length > 0 && entry.propertyValues
      ? this.renderPropertyValues(entity.properties, entry.propertyValues, entry.propertyValueDisplays)
      : '';

    const notesHtml = entry.notes ? `
      <div class="timeline-entry-notes">
        ${this.formatNotes(entry.notes)}
      </div>
    ` : '';

    // Location
    const locationHtml = entry.latitude && entry.longitude
      ? `<span class="timeline-entry-location">
          <i class="ph ph-map-pin"></i>
          <a href="https://www.google.com/maps?q=${entry.latitude},${entry.longitude}"
             target="_blank"
             rel="noopener noreferrer"
             class="location-link">
              ${entry.locationName || `${entry.latitude.toFixed(4)}, ${entry.longitude.toFixed(4)}`}
          </a>
        </span>`
      : '';

    // Images
    const imagesHtml = entry.images && entry.images.length > 0 ? `
      <div class="timeline-entry-media">
        ${entry.images.map(img => `<img src="${img}" alt="Entry image" class="timeline-media-image">`).join('')}
      </div>
    ` : '';

    return `
      <div class="timeline-entry" data-entry-id="${entry.id}">
        <div class="timeline-entry-card">
          <div class="timeline-entry-header">
            <div class="timeline-entry-primary">
              ${typeIcon && entryValue ? `<span class="timeline-entry-icon">${typeIcon}</span>` : ''}
              ${entryValue ? `<div class="timeline-entry-value">${entryValue}</div>` : ''}
              ${entityChip}
            </div>
            <button class="entry-menu-btn timeline-menu-btn" data-entry-id="${entry.id}" data-action="menu">
              <i class="ph ph-dots-three"></i>
            </button>
          </div>
          ${propertiesHtml ? `<div class="timeline-entry-properties">${propertiesHtml}</div>` : ''}
          ${notesHtml}
          ${hashtagChips ? `<div class="timeline-entry-tags">${hashtagChips}</div>` : ''}
          ${locationHtml ? `<div class="timeline-entry-metadata">${locationHtml}</div>` : ''}
          ${imagesHtml}
        </div>
      </div>
      <div class="entry-context-menu" id="entry-menu-${entry.id}" style="display: none;">
        <div class="context-menu-item" data-entry-id="${entry.id}" data-action="archive">
          <i class="ph-duotone ph-archive"></i>
          <span>Archive</span>
        </div>
        <div class="context-menu-item danger" data-entry-id="${entry.id}" data-action="delete">
          <i class="ph-duotone ph-trash"></i>
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

  private attachQuickEntryHandlers(): void {
    const input = this.querySelector('#quick-entry-input') as HTMLInputElement;

    if (!input) return;

    const handleSubmit = async () => {
      const notes = input.value.trim();
      if (!notes) return;

      const entity = this.store.getEntities().filter(e => e.name === "Inbox")[0];
      if (!entity) return;

      try {
        // Create entry with current timestamp and notes (prepend # for heading)
        const entry = new Entry({
          entityId: entity.id,
          entityName: entity.name,
          timestamp: new Date().toISOString(),
          notes: `# ${notes}`
        });

        // Clear input immediately for better UX
        input.value = '';

        // Add entry to store (optimistic update)
        await this.store.addEntry(entry);

      } catch (error) {
        console.error('Error creating quick entry:', error);
      }
    };

    // Submit on Enter key
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    });
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

      // Remove old listener if it exists
      if (this.sortMenuCloseHandler) {
        document.removeEventListener('click', this.sortMenuCloseHandler);
      }

      // Create and store new handler
      this.sortMenuCloseHandler = (e: Event) => {
        if (!filterMenu.contains(e.target as Node) && !filterBtn.contains(e.target as Node)) {
          filterMenu.style.display = 'none';
        }
      };

      // Close menu when clicking outside
      document.addEventListener('click', this.sortMenuCloseHandler);
    }
  }


  private toggleMenu(entryId: string, e: MouseEvent, customX?: number, customY?: number): void {
    const menu = this.querySelector(`#entry-menu-${entryId}`) as HTMLElement;
    console.log("toggleMenu", menu);
    if (!menu) return;

    // Check if this menu is already visible (toggle behavior)
    const isVisible = menu.style.display === 'block';

    // Check if event came from menu button click
    const target = e.target as HTMLElement;
    const menuButton = target.closest('[data-action="menu"]') as HTMLElement;

    // If clicking the menu button and menu is already visible, close it
    if (menuButton && isVisible) {
      this.hideAllMenus();
      return;
    }

    // Hide all other menus first
    this.hideAllMenus();

    // Position and show this menu
    menu.style.display = 'block';
    menu.style.position = 'fixed';

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

    // Setup document-level click handler to close menu when clicking outside
    this.setupEntryContextMenuCloseHandler();
  }

  private setupEntryContextMenuCloseHandler(): void {
    // Remove old listener if it exists
    if (this.entryContextMenuCloseHandler) {
      document.removeEventListener('click', this.entryContextMenuCloseHandler);
    }

    // Create and store new handler
    this.entryContextMenuCloseHandler = (e: Event) => {
      const target = e.target as HTMLElement;

      // Don't close if clicking on any menu button or menu itself
      if (target.closest('[data-action="menu"]') || target.closest('.entry-context-menu')) {
        return;
      }

      // Close all entry context menus
      this.hideAllMenus();
    };

    // Add document-level click listener
    document.addEventListener('click', this.entryContextMenuCloseHandler);
  }

  private hideAllMenus(): void {
    this.querySelectorAll('.entry-context-menu').forEach(menu => {
      (menu as HTMLElement).style.display = 'none';
    });
  }

  private handleDelete(entryId: string): void {
    // Get entry data before deletion for undo
    const entry = this.store.getEntryById(entryId);
    if (!entry) {
      toast.error('Entry not found');
      return;
    }

    // Show success toast immediately with undo option
    toast.show({
      message: 'Entry deleted',
      type: 'success',
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: async () => {
          try {
            await this.store.addEntry(entry);
            toast.success('Entry restored');
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            toast.error(`Failed to restore entry: ${message}`);
          }
        }
      }
    });

    // Delete in background (optimistic update)
    this.store.deleteEntry(entryId).catch((error) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error deleting entry: ${message}`);
    });
  }

  private async handleArchive(entryId: string): Promise<void> {
    try {
      await this.store.archiveEntry(entryId, true);
      toast.success('Entry archived successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error archiving entry: ${message}`);
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

      // Remove old listener if it exists
      if (this.entityFilterCloseHandler) {
        document.removeEventListener('click', this.entityFilterCloseHandler);
      }

      // Create and store new handler
      this.entityFilterCloseHandler = (e: Event) => {
        if (!filterMenu.contains(e.target as Node) && !filterBtn.contains(e.target as Node)) {
          filterMenu.style.display = 'none';
        }
      };

      // Close menu when clicking outside
      document.addEventListener('click', this.entityFilterCloseHandler);

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

      // Remove old listener if it exists
      if (this.tagFilterCloseHandler) {
        document.removeEventListener('click', this.tagFilterCloseHandler);
      }

      // Create and store new handler
      this.tagFilterCloseHandler = (e: Event) => {
        if (!filterMenu.contains(e.target as Node) && !filterBtn.contains(e.target as Node)) {
          filterMenu.style.display = 'none';
        }
      };

      // Close menu when clicking outside
      document.addEventListener('click', this.tagFilterCloseHandler);

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

  private setupEntityChipDropdownCloseHandler(): void {
    // Remove old listener if it exists
    if (this.entityChipDropdownCloseHandler) {
      document.removeEventListener('click', this.entityChipDropdownCloseHandler);
    }

    // Create and store new handler to close all entity chip dropdowns when clicking outside
    this.entityChipDropdownCloseHandler = (e: Event) => {
      const target = e.target as HTMLElement;

      // Don't close if clicking on any entity chip or dropdown
      if (target.closest('.entry-chip-entity-container')) {
        return;
      }

      // Close all entity chip dropdowns
      this.querySelectorAll('.entity-dropdown-menu').forEach(dropdown => {
        (dropdown as HTMLElement).style.display = 'none';
      });
    };

    // Add document-level click listener
    document.addEventListener('click', this.entityChipDropdownCloseHandler);
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

    // Remove old listener if it exists
    if (this.entityPageMenuCloseHandler) {
      document.removeEventListener('click', this.entityPageMenuCloseHandler);
    }

    // Create and store new handler
    this.entityPageMenuCloseHandler = () => this.hideEntityPageMenu();

    // Click outside to close menu
    document.addEventListener('click', this.entityPageMenuCloseHandler);
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
