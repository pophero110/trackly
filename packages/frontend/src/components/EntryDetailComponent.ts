import { WebComponent } from './WebComponent.js';
import { Entry } from '../models/Entry.js';
import { escapeHtml, formatDate, debounce } from '../utils/helpers.js';
import { URLStateManager } from '../utils/urlState.js';
import { EntityProperty } from '../types/index.js';
import { getEntityColor } from '../utils/entryHelpers.js';
import { createMilkdownEditor, destroyEditor, focusEditor } from '../utils/milkdown.js';
import type { Editor } from '@milkdown/core';

/**
 * EntryDetail Web Component for displaying a single entry's full details
 */
export class EntryDetailComponent extends WebComponent {
  private entryId: string | null = null;
  private unsubscribeUrl: (() => void) | null = null;
  private milkdownEditor: Editor | null = null;
  private editedNotes: string = '';
  private debouncedBackendSave: ({ (...args: any[]): void; cancel(): void; flush(): void; }) | null = null;
  private documentClickHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private entityDropdownCloseHandler: (() => void) | null = null;
  private imagePreviewKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();

    // Subscribe to URL changes
    this.unsubscribeUrl = URLStateManager.subscribe(() => {
      this.render();
    });

    // Add visibility change handler to save when tab becomes hidden
    this.visibilityHandler = () => {
      if (document.hidden && this.hasUnsavedChanges()) {
        console.log('[AutoSave] Tab becoming hidden - flushing pending save');
        this.debouncedBackendSave?.flush();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    // Add beforeunload handler to save on close
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    this.render();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    // If there are unsaved changes for the current entry, save them immediately
    if (this.hasUnsavedChanges() && this.entryId) {
      console.log(`[AutoSave] Component disconnecting with unsaved changes for entry ${this.entryId} - saving immediately`);
      this.saveToBackendWithId(this.entryId!, { keepalive: true, silent: true }); // Use keepalive for disconnect
    }

    // Flush any pending debounced save, then clear the reference
    console.log('[AutoSave] Component unmounting - flushing any pending save');
    this.debouncedBackendSave?.flush();
    this.debouncedBackendSave = null;

    // Clean up event listeners
    if (this.unsubscribeUrl) {
      this.unsubscribeUrl();
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    if (this.milkdownEditor) {
      destroyEditor(this.milkdownEditor);
      this.milkdownEditor = null;
    }
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
      this.documentClickHandler = null;
    }
    if (this.entityDropdownCloseHandler) {
      document.removeEventListener('click', this.entityDropdownCloseHandler);
      this.entityDropdownCloseHandler = null;
    }
    if (this.imagePreviewKeyHandler) {
      document.removeEventListener('keydown', this.imagePreviewKeyHandler);
      this.imagePreviewKeyHandler = null;
    }
    // Clean up menu from document body
    const menu = document.getElementById('detail-menu');
    if (menu) {
      menu.remove();
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
                <div class="entry-detail-page">
                    ${this.renderDetailHeader(entry, entity)}
                    ${this.renderDetailContent(entry, entity)}
                    ${this.renderDetailFooter(entry)}
                </div>
            </div>
        `;

    // Remove old modal if exists
    const oldModal = document.getElementById('image-preview-modal');
    if (oldModal) {
      oldModal.remove();
    }

    // Remove old context menu if exists
    const oldMenu = document.getElementById('detail-menu');
    if (oldMenu) {
      oldMenu.remove();
    }

    // Add context menu to document body
    const menuHtml = `
      <div class="entry-context-menu" id="detail-menu" style="display: none;">
        <div class="context-menu-item" data-action="archive"><i class="ph-duotone ph-archive"></i> Archive</div>
        <div class="context-menu-item danger" data-action="delete"><i class="ph-duotone ph-trash"></i> Delete</div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', menuHtml);

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
      ? `<div class="entry-chip-entity-container" style="position: relative;">
           <span class="entry-chip entry-chip-entity"
                 data-entity-id="${entity.id}"
                 data-entity-name="${escapeHtml(entity.name)}"
                 style="--entity-color: ${entityColor}; cursor: pointer;">
             ${escapeHtml(entity.name)}
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 4px; vertical-align: middle;">
               <polyline points="6 9 12 15 18 9"></polyline>
             </svg>
           </span>
           <div id="entity-dropdown-menu" class="entity-dropdown-menu" style="display: none;">
             ${entitiesDropdownHtml}
           </div>
         </div>`
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
                        <i class="ph-duotone ph-copy"></i>
                    </button>` : ''}
                    <button class="entry-menu-btn" id="detail-menu-btn" data-action="menu">⋮</button>
                </div>
            </div>
        `;
  }

  private renderDetailContent(entry: Entry, entity: any): string {
    // Properties section
    const propertiesHtml = this.renderPropertiesInline(entry, entity);
    const propertiesSection = propertiesHtml
      ? `<div class="entry-detail-properties">${propertiesHtml}</div>`
      : '';

    // Notes content - always show Milkdown editor
    const notesHtml = entry.notes ? `
      <div class="entry-notes-editor-container">
        <div id="milkdown-editor" class="milkdown-editor"></div>
      </div>
    ` : '';

    // Links section - combines external links and entry references
    const hasLinks = entry.links && entry.links.length > 0;
    const hasEntryReferences = entry.entryReferences && entry.entryReferences.length > 0;

    const linksHtml = (hasLinks || hasEntryReferences)
      ? `<div class="entry-links-section">
            <ul class="entry-links-list">
                ${hasLinks ? entry.links.map(link => {
        // Use title if available, otherwise fall back to URL
        const displayText = entry.linkTitles?.[link] || link;
        // Validate URL for security
        if (!this.isSafeUrl(link)) {
          return `
                    <li class="entry-link-item">
                        <span class="entry-link-url" title="Invalid or unsafe URL">${escapeHtml(displayText)}</span>
                    </li>
                  `;
        }
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

    // Images
    const imagesHtml = entry.images && entry.images.length > 0
      ? `<div class="entry-images-detail">
            ${entry.images.map((img, index) => `
                <div class="entry-image-wrapper">
                    <img src="${escapeHtml(img)}" alt="Entry image" class="entry-image-detail" data-image-index="${index}" style="cursor: pointer;" />
                    <button type="button" class="btn-remove-entry-image" data-image-index="${index}" title="Remove image">×</button>
                </div>
            `).join('')}
         </div>`
      : '';

    return `
            ${propertiesSection}
            <div class="entry-detail-content">
                ${notesHtml}
                ${imagesHtml}
                ${linksHtml}
            </div>
        `;
  }

  private renderDetailFooter(entry: Entry): string {
    // Extract hashtags from notes
    const hashtags = entry.notes ? this.extractHashtags(entry.notes) : [];
    const hashtagsHtml = hashtags.length > 0
      ? `<div class="entry-footer-hashtags">
           ${hashtags.map(tag => `<span class="hashtag-tag">#${escapeHtml(tag)}</span>`).join('')}
         </div>`
      : '';

    return `
            <div class="entry-detail-footer">
                ${hashtagsHtml}
                <div class="action-menu-buttons">
                    <button type="button" id="upload-image-btn" class="btn-action-menu" title="Upload images">
                        <i class="ph-duotone ph-image"></i>
                    </button>
                    <button type="button" id="add-link-btn" class="btn-action-menu" title="Add link to notes">
                        <i class="ph-duotone ph-link"></i>
                    </button>
                    <button type="button" id="location-btn" class="btn-action-menu" title="Add location">
                        <i class="ph-duotone ph-map-pin"></i>
                    </button>
                </div>
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
      // Validate URL for security
      if (!this.isSafeUrl(valueStr)) {
        return `<span title="Invalid or unsafe URL">${escapeHtml(linkText)}</span>`;
      }
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

  private isSafeUrl(url: string): boolean {
    // Validate URL protocol to prevent XSS attacks
    const trimmedUrl = url.trim().toLowerCase();

    // Allow common safe protocols
    const safeProtocols = ['http://', 'https://', 'mailto:', 'tel:', 'sms:'];

    // Check if URL starts with a safe protocol
    const hasSafeProtocol = safeProtocols.some(protocol => trimmedUrl.startsWith(protocol));

    // Allow relative URLs (starting with / or # or ?)
    const isRelative = trimmedUrl.startsWith('/') || trimmedUrl.startsWith('#') || trimmedUrl.startsWith('?');

    // Block dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:'];
    const hasDangerousProtocol = dangerousProtocols.some(protocol => trimmedUrl.startsWith(protocol));

    return (hasSafeProtocol || isRelative) && !hasDangerousProtocol;
  }

  private attachEventHandlers(): void {
    this.attachMenuHandlers();
    this.attachEntityChipHandler();
    this.attachImagePreviewHandlers();
    this.attachNotesEditorHandlers();
    this.attachActionButtonHandlers();
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

    // Menu item clicks - menu is now at document body level
    const menu = document.getElementById('detail-menu');
    if (menu) {
      menu.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
          const target = e.currentTarget as HTMLElement;
          const action = target.dataset.action;

          if (action === 'archive') {
            this.handleArchive();
          } else if (action === 'delete') {
            this.handleDelete();
          }
          this.hideMenu();
        });
      });
    }

    // Remove old document click handler if exists
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
    }

    // Add new document click handler to close menu
    this.documentClickHandler = () => this.hideMenu();
    document.addEventListener('click', this.documentClickHandler);
  }

  private toggleMenu(e: MouseEvent): void {
    const menu = document.getElementById('detail-menu') as HTMLElement;
    if (!menu) return;

    const isVisible = menu.style.display === 'block';

    if (isVisible) {
      this.hideMenu();
      return;
    }

    const target = e.target as HTMLElement;
    const menuButton = target.closest('#detail-menu-btn') as HTMLElement;

    if (menuButton) {
      const rect = menuButton.getBoundingClientRect();

      // Position menu using right edge - simplest approach, no width measurement needed
      menu.style.display = 'block';
      menu.style.position = 'fixed';
      menu.style.zIndex = '10000';
      menu.style.right = `${window.innerWidth - rect.right}px`;
      menu.style.top = `${rect.bottom + 4}px`;
      menu.style.left = 'auto'; // Clear any previous left value
    }
  }

  private hideMenu(): void {
    const menu = document.getElementById('detail-menu') as HTMLElement;
    if (menu) {
      menu.style.display = 'none';
    }
  }

  private handleDelete(): void {
    // Navigate back immediately (optimistic update)
    window.history.back();

    // Delete in background
    this.store.deleteEntry(this.entryId!).catch((error) => {
      console.error('Error deleting entry:', error);
    });
  }

  private handleArchive(): void {
    this.store.archiveEntry(this.entryId!, true).then(() => {
      window.history.back();
    }).catch((error) => {
      console.error('Error archiving entry:', error);
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
    });
  }

  private attachEntityChipHandler(): void {
    const entityChip = this.querySelector('.entry-chip-entity');
    const entityDropdown = this.querySelector('#entity-dropdown-menu') as HTMLElement;

    if (entityChip && entityDropdown) {
      // Show dropdown when chip is clicked
      entityChip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Toggle dropdown visibility
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

          if (newEntity && this.entryId) {
            try {
              // Update the entry with new entity
              await this.store.updateEntry(this.entryId, {
                entityId: newEntityId,
                entityName: newEntity.name
              });

              // Hide dropdown after change
              entityDropdown.style.display = 'none';
            } catch (error) {
              console.error('Error updating entry entity:', error);
            }
          }
        });
      });

      // Remove old handler if exists
      if (this.entityDropdownCloseHandler) {
        document.removeEventListener('click', this.entityDropdownCloseHandler);
      }

      // Hide dropdown when clicking outside
      this.entityDropdownCloseHandler = (e: MouseEvent) => {
        if (entityDropdown.style.display === 'block' &&
          !entityDropdown.contains(e.target as Node) &&
          !entityChip.contains(e.target as Node)) {
          entityDropdown.style.display = 'none';
        }
      };
      document.addEventListener('click', this.entityDropdownCloseHandler);
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

    // Remove old keyboard handler if exists
    if (this.imagePreviewKeyHandler) {
      document.removeEventListener('keydown', this.imagePreviewKeyHandler);
    }

    // Keyboard navigation
    this.imagePreviewKeyHandler = (e: KeyboardEvent) => {
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

    document.addEventListener('keydown', this.imagePreviewKeyHandler);

    // Attach remove image handlers
    const removeImageBtns = this.querySelectorAll('.btn-remove-entry-image');
    removeImageBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent opening the image preview modal
        const index = parseInt((btn as HTMLElement).dataset.imageIndex || '0');
        await this.handleRemoveImage(index);
      });
    });
  }

  private attachNotesEditorHandlers(): void {
    // Initialize Milkdown editor after render
    const entry = this.store.getEntryById(this.entryId!);
    if (entry && entry.notes) {
      this.initializeMilkdownEditor(entry.notes);
    }
  }

  private async initializeMilkdownEditor(initialNotes: string): Promise<void> {
    console.log('[AutoSave] Initializing Milkdown editor', {
      entryId: this.entryId,
      notesLength: initialNotes.length,
      hasExistingEditedNotes: !!this.editedNotes
    });

    // Only set editedNotes if not already set
    if (!this.editedNotes) {
      this.editedNotes = initialNotes;
    }

    // Capture the entryId at initialization time
    const capturedEntryId = this.entryId;

    // Create debounced backend save function only once (1 second)
    if (!this.debouncedBackendSave) {
      console.log('[AutoSave] Creating debounced save function (1s debounce)');
      this.debouncedBackendSave = debounce(() => {
        console.log('[AutoSave] Debounce timer expired (1s) - checking if save needed', {
          currentEntryId: this.entryId,
          capturedEntryId,
          hasUnsavedChanges: this.hasUnsavedChanges()
        });

        // Use captured entryId if current one is null
        const entryIdToSave = this.entryId || capturedEntryId;
        if (entryIdToSave && this.hasUnsavedChanges()) {
          console.log('[AutoSave] Triggering silent save to backend', { entryId: entryIdToSave });
          // This save should be silent to avoid UI flicker while typing
          this.saveToBackendWithId(entryIdToSave, { silent: true });
        } else {
          console.log('[AutoSave] Skipping save - no changes or missing entryId');
        }
      }, 1000); // 1 second
    }

    const editorContainer = this.querySelector('#milkdown-editor') as HTMLElement;
    if (editorContainer) {
      try {
        // Create new editor with hybrid auto-save on change
        this.milkdownEditor = await createMilkdownEditor(
          editorContainer,
          this.editedNotes,
          (markdown) => {
            console.log('[AutoSave] Content changed', {
              entryId: this.entryId,
              newLength: markdown.length,
              oldLength: this.editedNotes.length,
              diff: markdown.length - this.editedNotes.length
            });

            // 1. Immediate local update for unsaved changes tracking
            this.editedNotes = markdown;

            // 2. Debounced backend save (1s)
            if (this.debouncedBackendSave) {
              console.log('[AutoSave] Calling debounced save (will execute after 1s of inactivity)');
              this.debouncedBackendSave();
            }
          }
        );

        console.log('[AutoSave] Editor created successfully');

        // Automatically focus the editor after a brief delay
        setTimeout(() => {
          if (this.milkdownEditor) {
            focusEditor(this.milkdownEditor);
          }
        }, 100);
      } catch (error) {
        console.error('Failed to initialize Milkdown editor:', error);
      }
    }
  }

  private handleBeforeUnload = (): void => {
    if (this.hasUnsavedChanges()) {
      console.log('[AutoSave] Window beforeunload - flushing pending save');
      this.debouncedBackendSave?.flush();
    }
  };

  private hasUnsavedChanges(): boolean {
    if (!this.entryId || !this.editedNotes) {
      return false;
    }

    const currentEntry = this.store.getEntryById(this.entryId);
    const hasChanges = currentEntry ? currentEntry.notes !== this.editedNotes : false;

    console.log('[AutoSave] Checking for unsaved changes', {
      entryId: this.entryId,
      hasChanges,
      editedLength: this.editedNotes.length,
      storedLength: currentEntry?.notes?.length || 0
    });

    return hasChanges;
  }

  private async saveToBackendWithId(entryId: string, options?: { keepalive?: boolean; silent?: boolean }): Promise<void> {
    if (!this.editedNotes) {
      console.log('[AutoSave] Skipping save - no notes to save');
      return;
    }

    const startTime = Date.now();
    console.log('[AutoSave] Starting save to backend', {
      entryId,
      notesLength: this.editedNotes.length,
      silent: options?.silent ?? false,
      keepalive: options?.keepalive ?? false
    });

    try {
      // Save to backend using the store. Default to a non-silent save unless specified.
      await this.store.updateEntry(entryId, {
        notes: this.editedNotes
      }, {
        silent: options?.silent ?? false,
        keepalive: options?.keepalive ?? false
      });

      const duration = Date.now() - startTime;
      console.log(`[AutoSave] Save completed successfully in ${duration}ms`, {
        entryId,
        notesLength: this.editedNotes.length
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[AutoSave] Save failed after ${duration}ms:`, error);
    }
  }

  private attachActionButtonHandlers(): void {
    const uploadImageBtn = this.querySelector('#upload-image-btn') as HTMLButtonElement;
    const addLinkBtn = this.querySelector('#add-link-btn') as HTMLButtonElement;
    const locationBtn = this.querySelector('#location-btn') as HTMLButtonElement;

    // Upload image button - directly open file picker
    if (uploadImageBtn) {
      uploadImageBtn.addEventListener('click', () => {
        // Create hidden file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.multiple = true;
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', (e) => {
          this.handleImageUpload(e);
          fileInput.remove();
        });

        document.body.appendChild(fileInput);
        fileInput.click();
      });
    }

    if (addLinkBtn) {
      addLinkBtn.addEventListener('click', () => {
        // TODO: Implement add link functionality
      });
    }

    if (locationBtn) {
      locationBtn.addEventListener('click', async () => {
        const originalIcon = locationBtn.innerHTML;
        try {
          locationBtn.disabled = true;
          locationBtn.innerHTML = '<i class="ph-duotone ph-spinner"></i>';
          await this.handleLocationCapture();
        } catch (error) {
          console.error('Location error:', error);
        } finally {
          locationBtn.disabled = false;
          locationBtn.innerHTML = originalIcon;
        }
      });
    }
  }

  private handleImageUpload(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = input.files;

    if (!files || files.length === 0 || !this.entryId) return;

    const entry = this.store.getEntryById(this.entryId);
    if (!entry) return;

    const currentImages = entry.images || [];
    const newImages: string[] = [];

    let processedCount = 0;
    const totalFiles = files.length;

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          newImages.push(result);
          processedCount++;

          // Update entry when all images are processed
          if (processedCount === totalFiles) {
            this.store.updateEntry(this.entryId!, {
              images: [...currentImages, ...newImages]
            }).catch(error => {
              console.error('Error updating entry with images:', error);
            });
          }
        };
        reader.readAsDataURL(file);
      } else {
        processedCount++;
      }
    });
  }

  private async handleLocationCapture(): Promise<void> {
    if (!this.entryId) return;

    const entry = this.store.getEntryById(this.entryId);
    if (!entry) return;

    // Request geolocation permission and get current position
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });

    const location = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };

    // Reverse geocode to get location name
    const locationName = await this.reverseGeocode(position.coords.latitude, position.coords.longitude);

    // Update entry with location
    await this.store.updateEntry(this.entryId, {
      latitude: location.latitude,
      longitude: location.longitude,
      locationName: locationName || undefined
    });
  }

  private async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        {
          headers: {
            'User-Agent': 'Trackly App'
          }
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const address = data.address;

      // Build short version (City, State/Province)
      const shortParts: string[] = [];

      if (address.city || address.town || address.village) {
        shortParts.push(address.city || address.town || address.village);
      }

      if (address.state) {
        shortParts.push(address.state);
      } else if (address.county) {
        shortParts.push(address.county);
      }

      return shortParts.length > 0 ? shortParts.join(', ') : null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }

  private async handleRemoveImage(index: number): Promise<void> {
    if (!this.entryId) return;

    const entry = this.store.getEntryById(this.entryId);
    if (!entry || !entry.images) return;

    // Create a new array without the image at the specified index
    const updatedImages = entry.images.filter((_, i) => i !== index);

    // Update the entry with the new images array
    await this.store.updateEntry(this.entryId, {
      images: updatedImages
    }).catch(error => {
      console.error('Error removing image from entry:', error);
    });
  }
}
