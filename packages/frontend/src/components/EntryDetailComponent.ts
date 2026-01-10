import { WebComponent } from './WebComponent.js';
import { Entry } from '../models/Entry.js';
import { escapeHtml, formatDate } from '../utils/helpers.js';
import { parseMarkdown } from '../utils/markdown.js';
import { URLStateManager } from '../utils/urlState.js';
import { EntityProperty } from '../types/index.js';
import { getEntityColor } from '../utils/entryHelpers.js';

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
                    ${this.renderLoadingState('Loading entry...')}
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
            <div class="section">
                <div class="entry-detail-page page-grid">
                    ${this.renderDetailHeader(entry, entity)}
                    ${this.renderDetailContent(entry, entity)}
                </div>
            </div>
        `;

    // Remove old modal if exists
    const oldModal = document.getElementById('image-preview-modal');
    if (oldModal) {
      oldModal.remove();
    }

    // Add modal to document body
    if (entry.images && entry.images.length > 0) {
      const modalHtml = `
            <div class="image-preview-modal" id="image-preview-modal" style="display: none;">
                <div class="image-preview-overlay"></div>
                <button class="image-preview-close" id="image-preview-close">×</button>
                ${entry.images.length > 1 ? `
                    <button class="image-preview-nav image-preview-prev" id="image-preview-prev">‹</button>
                    <button class="image-preview-nav image-preview-next" id="image-preview-next">›</button>
                ` : ''}
                <div class="image-preview-container">
                    <img class="image-preview-img" id="image-preview-img" src="" alt="Preview" />
                    ${entry.images.length > 1 ? '<div class="image-preview-counter" id="image-preview-counter"></div>' : ''}
                </div>
            </div>
        `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

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
                <div class="entry-detail-actions">
                    ${entry.notes ? `<button class="btn-icon" id="copy-notes-btn" title="Copy notes">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>` : ''}
                    <button class="entry-menu-btn" id="detail-menu-btn" data-action="menu">⋮</button>
                </div>
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

    // Links section - combines external links and entry references
    const hasLinks = entry.links && entry.links.length > 0;
    const hasEntryReferences = entry.entryReferences && entry.entryReferences.length > 0;

    const linksHtml = (hasLinks || hasEntryReferences)
      ? `<div class="entry-links-section">
            <ul class="entry-links-list">
                ${hasLinks ? entry.links.map(link => {
        // Use title if available, otherwise fall back to URL
        const displayText = entry.linkTitles?.[link] || link;
        return `
                    <li class="entry-link-item">
                        <a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" class="entry-link-url" title="${escapeHtml(link)}">
                            ${escapeHtml(displayText)}
                        </a>
                    </li>
                `}).join('') : ''}
                ${hasEntryReferences ? entry.entryReferences.map(refId => {
        const refEntry = this.store.getEntryById(refId);
        if (!refEntry) return '';
        // Get first line of notes as title, or use entity name
        const title = refEntry.notes ? refEntry.notes.split('\n')[0].replace(/^#\s*/, '').trim() : refEntry.entityName;
        return `
                    <li class="entry-link-item">
                        <a href="/entries/${escapeHtml(refId)}" class="entry-link-url">
                            ${escapeHtml(title)}
                        </a>
                    </li>
                `}).filter(html => html).join('') : ''}
            </ul>
         </div>`
      : '';

    // Tags (Hashtags only)
    const tagsHtml = entry.notes ? this.renderTags(entry.notes) : '';

    // Images
    const imagesHtml = entry.images && entry.images.length > 0
      ? `<div class="entry-images-detail">
            ${entry.images.map((img, index) => `
                <img src="${escapeHtml(img)}" alt="Entry image" class="entry-image-detail" data-image-index="${index}" style="cursor: pointer;" />
            `).join('')}
         </div>`
      : '';

    return `
            ${propertiesSection}
            <div class="entry-detail-content">
                ${notesHtml}
                ${imagesHtml}
                ${tagsHtml}
                ${linksHtml}
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
    this.attachImagePreviewHandlers();
  }

  private attachMenuHandlers(): void {
    const menuBtn = this.querySelector('#detail-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMenu(e as MouseEvent);
      });
    }

    // Copy notes button
    const copyBtn = this.querySelector('#copy-notes-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleCopyNotes();
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

  private handleCopyNotes(): void {
    const entry = this.store.getEntryById(this.entryId!);
    if (!entry || !entry.notes) return;

    navigator.clipboard.writeText(entry.notes).then(() => {
      // Show temporary success feedback
      const button = this.querySelector('#copy-notes-btn') as HTMLElement;
      if (button) {
        const originalHTML = button.innerHTML;
        button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>`;
        button.style.color = 'var(--success, #22c55e)';
        setTimeout(() => {
          button.innerHTML = originalHTML;
          button.style.color = '';
        }, 1500);
      }
    }).catch((error) => {
      console.error('Failed to copy notes:', error);
      alert('Failed to copy notes to clipboard');
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


  private attachImagePreviewHandlers(): void {
    const images = this.querySelectorAll('.entry-image-detail');
    const modal = document.getElementById('image-preview-modal') as HTMLElement;
    const modalImg = document.getElementById('image-preview-img') as HTMLImageElement;
    const closeBtn = document.getElementById('image-preview-close');
    const prevBtn = document.getElementById('image-preview-prev');
    const nextBtn = document.getElementById('image-preview-next');
    const counter = document.getElementById('image-preview-counter') as HTMLElement;
    const overlay = document.querySelector('.image-preview-overlay') as HTMLElement;

    // Get current entry
    if (!this.entryId) return;
    const entry = this.store.getEntryById(this.entryId);
    if (!entry || !entry.images || entry.images.length === 0) return;

    let currentIndex = 0;
    const totalImages = entry.images.length;

    const showImage = (index: number) => {
      currentIndex = index;
      if (modalImg && entry && entry.images) {
        modalImg.src = entry.images[index];
      }
      if (counter && totalImages > 1) {
        counter.textContent = `${index + 1} / ${totalImages}`;
      }
    };

    const openModal = (index: number) => {
      if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        showImage(index);
      }
    };

    const closeModal = () => {
      if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
      }
    };

    // Attach click handlers to images
    images.forEach((img) => {
      img.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt((img as HTMLElement).dataset.imageIndex || '0');
        openModal(index);
      });
    });

    // Close button
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    // Overlay click to close
    if (overlay) {
      overlay.addEventListener('click', closeModal);
    }

    // Navigation buttons
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        const newIndex = currentIndex > 0 ? currentIndex - 1 : totalImages - 1;
        showImage(newIndex);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const newIndex = currentIndex < totalImages - 1 ? currentIndex + 1 : 0;
        showImage(newIndex);
      });
    }

    // Keyboard navigation
    const handleKeyPress = (e: KeyboardEvent) => {
      if (modal && modal.style.display === 'flex') {
        if (e.key === 'Escape') {
          closeModal();
        } else if (e.key === 'ArrowLeft') {
          const newIndex = currentIndex > 0 ? currentIndex - 1 : totalImages - 1;
          showImage(newIndex);
        } else if (e.key === 'ArrowRight') {
          const newIndex = currentIndex < totalImages - 1 ? currentIndex + 1 : 0;
          showImage(newIndex);
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
  }
}
