import { WebComponent } from './WebComponent.js';
import { Entry } from '../models/Entry.js';
import { escapeHtml, formatDate } from '../utils/helpers.js';
import { parseMarkdown } from '../utils/markdown.js';
import { URLStateManager } from '../utils/urlState.js';
import { EntityProperty } from '../types/index.js';
import { getEntityColor, renderReferences } from '../utils/entryHelpers.js';

/**
 * EntryDetail Web Component for displaying a single entry's full details
 */
export class EntryDetailComponent extends WebComponent {
  private entryId: string | null = null;
  private unsubscribeUrl: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();

    // Subscribe to URL changes
    this.unsubscribeUrl = URLStateManager.subscribe(() => {
      this.render();
    });

    this.render();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.unsubscribeUrl) {
      this.unsubscribeUrl();
    }
  }

  render(): void {
    // Get entry ID from URL on each render
    const path = window.location.pathname;
    const match = path.match(/^\/entries\/([^/]+)$/);
    this.entryId = match ? match[1] : null;

    if (!this.entryId) {
      this.innerHTML = `
                <div class="section">
                    <div class="error-state">Entry not found</div>
                </div>
            `;
      return;
    }

    // Check if store data is loaded
    if (!this.store.getIsLoaded()) {
      this.innerHTML = `
                <div class="section">
                    <div class="error-state">Loading...</div>
                </div>
            `;
      return;
    }

    const entry = this.store.getEntryById(this.entryId);
    if (!entry) {
      this.innerHTML = `
                <div class="section">
                    <div class="error-state">Entry not found</div>
                </div>
            `;
      return;
    }

    const entity = this.store.getEntityById(entry.entityId);

    this.innerHTML = `
            <div class="section entry-detail-page">
                ${this.renderDetailHeader(entry, entity)}
                ${this.renderDetailContent(entry, entity)}
            </div>
        `;

    this.attachEventHandlers();
  }

  private renderDetailHeader(entry: Entry, entity: any): string {
    const entityColor = entity ? getEntityColor(entity.name) : '';
    const entityChip = entity
      ? `<span class="entry-chip entry-chip-entity"
                     data-entity-name="${escapeHtml(entity.name)}"
                     style="--entity-color: ${entityColor}">
                 ${escapeHtml(entity.name)}
               </span>`
      : '';

    // Location display (inline with timestamp, same as entry card)
    const locationHtml = entry.latitude && entry.longitude
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
            <div class="entry-detail-header">
                <div class="entry-detail-meta">
                    ${entityChip}
                    <span class="entry-detail-timestamp">🕒 ${formatDate(entry.timestamp)}</span>
                    ${locationHtml}
                </div>
                <button class="entry-menu-btn" id="detail-menu-btn" data-action="menu">⋮</button>
            </div>
            <div class="entry-context-menu" id="detail-menu" style="display: none;">
                <div class="context-menu-item" data-action="edit">Edit</div>
                <div class="context-menu-item" data-action="archive">Archive</div>
                <div class="context-menu-item danger" data-action="delete">Delete</div>
            </div>
        `;
  }

  private getEntryTitle(entry: Entry): string {
    // Use value as title if available
    if (entry.value !== undefined && entry.value !== null) {
      return entry.valueDisplay || String(entry.value);
    }

    // Extract first line from notes as title
    if (entry.notes) {
      const firstLine = entry.notes.split('\n')[0].trim();
      // Remove markdown formatting for title
      return firstLine.replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/\*/g, '').substring(0, 100);
    }

    return '';
  }

  private getRelativeTime(timestamp: string): string {
    const now = new Date();
    const entryDate = new Date(timestamp);
    const diffMs = now.getTime() - entryDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`;
  }

  private renderDetailContent(entry: Entry, entity: any): string {
    // Properties section
    const propertiesHtml = this.renderPropertiesInline(entry, entity);
    const propertiesSection = propertiesHtml
      ? `<div class="entry-detail-properties">${propertiesHtml}</div>`
      : '';

    // Notes content
    const notesHtml = entry.notes ? `<div class="entry-notes-detail">${this.formatNotes(entry.notes)}</div>` : '';

    // References (URLs only)
    const referencesHtml = entry.notes ? renderReferences(entry.notes, { includeHashtags: false }) : '';

    // Tags (Hashtags only)
    const tagsHtml = entry.notes ? this.renderTags(entry.notes) : '';

    // Images
    const imagesHtml = entry.images && entry.images.length > 0
      ? `<div class="entry-images-detail">
            ${entry.images.map(img => `
                <img src="${escapeHtml(img)}" alt="Entry image" class="entry-image-detail" />
            `).join('')}
         </div>`
      : '';

    return `
            ${propertiesSection}
            <div class="entry-detail-content">
                ${notesHtml}
                ${imagesHtml}
                ${tagsHtml}
                ${referencesHtml}
            </div>
        `;
  }

  private renderPropertiesInline(entry: Entry, entity: any): string {
    if (!entity || !entity.properties || entity.properties.length === 0) {
      return '';
    }

    const propertyValues = entry.propertyValues || {};
    const propertyValueDisplays = entry.propertyValueDisplays || {};

    const propertiesWithValues = entity.properties.filter((prop: EntityProperty) =>
      propertyValues[prop.id] !== undefined && propertyValues[prop.id] !== null && propertyValues[prop.id] !== ''
    );

    if (propertiesWithValues.length === 0) {
      return '';
    }

    return propertiesWithValues.map((prop: EntityProperty) => {
      const value = propertyValues[prop.id];
      const displayValue = propertyValueDisplays[prop.id];
      const formattedValue = this.formatPropertyValue(value, prop.valueType, displayValue);

      return `
                <div class="entry-metadata-item">
                    <span class="metadata-label">${escapeHtml(prop.name)}</span>
                    <span class="metadata-value">${formattedValue}</span>
                </div>
            `;
    }).join('');
  }

  private formatPropertyValue(value: string | number | boolean, valueType?: string, displayValue?: string): string {
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

    // Use displayValue if available, otherwise escape the raw value
    return escapeHtml(displayValue || valueStr);
  }

  private renderProperties(entry: Entry, entity: any): string {
    if (!entity || !entity.properties || entity.properties.length === 0) {
      return '';
    }

    const propertyValues = entry.propertyValues || {};
    const propertyValueDisplays = entry.propertyValueDisplays || {};

    const propertiesWithValues = entity.properties.filter((prop: EntityProperty) =>
      propertyValues[prop.id] !== undefined && propertyValues[prop.id] !== null && propertyValues[prop.id] !== ''
    );

    if (propertiesWithValues.length === 0) {
      return '';
    }

    const propertiesHtml = propertiesWithValues.map((prop: EntityProperty) => {
      const value = propertyValues[prop.id];
      const displayValue = propertyValueDisplays[prop.id];
      const formattedValue = this.formatPropertyValue(value, prop.valueType, displayValue);

      return `
                <div class="property-row">
                    <span class="property-name">${escapeHtml(prop.name)}:</span>
                    <span class="property-value">${formattedValue}</span>
                </div>
            `;
    }).join('');

    return `
            <div class="entry-detail-section">
                <h3 class="entry-detail-section-title">Properties</h3>
                <div class="entry-properties-detail">
                    ${propertiesHtml}
                </div>
            </div>
        `;
  }

  private formatNotes(notes: string): string {
    const formatted = parseMarkdown(notes);
    return this.linkifyHashtags(formatted);
  }

  private linkifyHashtags(text: string): string {
    const hashtagRegex = /(?<![a-zA-Z0-9_])#([a-zA-Z0-9_]+)(?![a-zA-Z0-9_])/g;
    return text.replace(hashtagRegex, (match, tag) => {
      return `<a href="#" class="hashtag-link" data-hashtag="${tag}">${match}</a>`;
    });
  }

  private renderTags(notes: string): string {
    const hashtags = this.extractHashtags(notes);
    if (hashtags.length === 0) return '';

    const hashtagsHtml = hashtags.map(tag => {
      return `<a href="#" class="hashtag-link reference-link" data-hashtag="${escapeHtml(tag)}">#${escapeHtml(tag)}</a>`;
    }).join('');

    return `
      <div class="entry-tags-detail">
        <div class="references-links">${hashtagsHtml}</div>
      </div>
    `;
  }

  private extractHashtags(text: string): string[] {
    // Remove markdown links first to avoid matching hashtags in URLs
    const textWithoutLinks = text.replace(/\[([^\]]+?)\]\((.+?)\)/g, '');

    const hashtagRegex = /(?<![a-zA-Z0-9_])#([a-zA-Z0-9_]+)(?![a-zA-Z0-9_])/g;
    const hashtags: string[] = [];
    let match;

    while ((match = hashtagRegex.exec(textWithoutLinks)) !== null) {
      // Avoid duplicates
      if (!hashtags.includes(match[1])) {
        hashtags.push(match[1]);
      }
    }

    return hashtags;
  }

  private attachEventHandlers(): void {
    this.attachMenuHandlers();
    this.attachHashtagHandlers();
    this.attachEntityChipHandler();
  }

  private attachMenuHandlers(): void {
    const menuBtn = this.querySelector('#detail-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMenu(e as MouseEvent);
      });
    }

    // Menu item clicks
    this.querySelectorAll('#detail-menu .context-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const action = target.dataset.action;

        if (action === 'edit') {
          URLStateManager.openEditEntryPanel(this.entryId!);
        } else if (action === 'archive') {
          this.handleArchive();
        } else if (action === 'delete') {
          this.handleDelete();
        }
        this.hideMenu();
      });
    });

    // Click outside to close menu
    document.addEventListener('click', () => this.hideMenu());
  }

  private toggleMenu(e: MouseEvent): void {
    const menu = this.querySelector('#detail-menu') as HTMLElement;
    if (!menu) return;

    const isVisible = menu.style.display === 'block';

    if (isVisible) {
      this.hideMenu();
      return;
    }

    // Show menu
    menu.style.display = 'block';
    menu.style.position = 'fixed';

    const target = e.target as HTMLElement;
    const menuButton = target.closest('#detail-menu-btn') as HTMLElement;

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

  private hideMenu(): void {
    const menu = this.querySelector('#detail-menu') as HTMLElement;
    if (menu) {
      menu.style.display = 'none';
    }
  }

  private handleDelete(): void {
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    this.store.deleteEntry(this.entryId!).then(() => {
      window.history.back();
    }).catch((error) => {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry. Please try again.');
    });
  }

  private handleArchive(): void {
    this.store.archiveEntry(this.entryId!, true).then(() => {
      window.history.back();
    }).catch((error) => {
      console.error('Error archiving entry:', error);
      alert('Failed to archive entry. Please try again.');
    });
  }

  private attachHashtagHandlers(): void {
    const hashtagLinks = this.querySelectorAll('.hashtag-link');
    hashtagLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const hashtag = (link as HTMLElement).dataset.hashtag;
        if (hashtag) {
          URLStateManager.setHashtagFilter(hashtag);
          window.history.back();
        }
      });
    });
  }

  private attachEntityChipHandler(): void {
    const entityChip = this.querySelector('.entry-chip-entity');
    if (entityChip) {
      entityChip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const entityName = (entityChip as HTMLElement).dataset.entityName;
        if (entityName) {
          URLStateManager.showEntryList(entityName);
        }
      });
    }
  }
}
