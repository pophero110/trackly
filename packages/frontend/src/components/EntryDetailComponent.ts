import { WebComponent } from './WebComponent.js';
import { Entry } from '../models/Entry.js';
import { escapeHtml, formatDate, debounce } from '../utils/helpers.js';
import { parseMarkdown } from '../utils/markdown.js';
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
  private saveStatus: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
  private debouncedSave: ((...args: any[]) => void) | null = null;

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
    if (this.milkdownEditor) {
      destroyEditor(this.milkdownEditor);
      this.milkdownEditor = null;
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
                        <i class="ph-duotone ph-copy"></i>
                    </button>` : ''}
                    <button class="entry-menu-btn" id="detail-menu-btn" data-action="menu">⋮</button>
                </div>
            </div>
            <div class="entry-context-menu" id="detail-menu" style="display: none;">
                <div class="context-menu-item" data-action="edit"><i class="ph-duotone ph-pencil-simple"></i> Edit</div>
                <div class="context-menu-item" data-action="archive"><i class="ph-duotone ph-archive"></i> Archive</div>
                <div class="context-menu-item danger" data-action="delete"><i class="ph-duotone ph-trash"></i> Delete</div>
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

    // Notes content - always show Milkdown editor
    const notesHtml = entry.notes ? `
      <div class="entry-notes-editor-container">
        <div id="milkdown-editor" class="milkdown-editor"></div>
        <div class="save-status" id="save-status"></div>
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
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                    </button>
                    <button type="button" id="add-link-btn" class="btn-action-menu" title="Add link to notes">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                    </button>
                    <button type="button" id="location-btn" class="btn-action-menu" title="Add location">📍</button>
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
    // Navigate back immediately (optimistic update)
    window.history.back();

    // Delete in background
    this.store.deleteEntry(this.entryId!).catch((error) => {
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
    console.log('[AutoSave] Initializing editor with auto-save (2s debounce)');
    this.editedNotes = initialNotes;

    // Create debounced save function (2 second delay)
    this.debouncedSave = debounce(() => {
      console.log('[AutoSave] Debounce timer expired (2s) - executing save');
      this.saveNotes();
    }, 2000);

    const editorContainer = this.querySelector('#milkdown-editor') as HTMLElement;
    if (editorContainer) {
      try {
        // Destroy existing editor if any
        if (this.milkdownEditor) {
          destroyEditor(this.milkdownEditor);
          this.milkdownEditor = null;
        }

        // Create new editor with auto-save on change
        this.milkdownEditor = await createMilkdownEditor(
          editorContainer,
          this.editedNotes,
          (markdown) => {
            console.log('[AutoSave] Content changed - debounce timer started/reset');
            this.editedNotes = markdown;
            // Trigger auto-save with debounce
            if (this.debouncedSave) {
              this.debouncedSave();
            }
          }
        );

        // Automatically focus the editor after a brief delay
        // to ensure it's fully rendered
        setTimeout(() => {
          if (this.milkdownEditor) {
            focusEditor(this.milkdownEditor);
          }
        }, 100);
      } catch (error) {
        console.error('Failed to initialize Milkdown editor:', error);
        alert('Failed to initialize editor. Please try again.');
      }
    }
  }

  private async saveNotes(): Promise<void> {
    if (!this.entryId || !this.editedNotes) {
      console.log('[AutoSave] Save skipped - no entry ID or notes');
      return;
    }

    const startTime = Date.now();
    console.log('[AutoSave] Starting save operation...', {
      entryId: this.entryId,
      noteLength: this.editedNotes.length,
      timestamp: new Date().toISOString()
    });

    this.updateSaveStatus('saving');

    try {
      // Update the entry with new notes
      await this.store.updateEntry(this.entryId, {
        notes: this.editedNotes
      });

      const duration = Date.now() - startTime;
      console.log(`[AutoSave] Save completed successfully in ${duration}ms`);

      this.updateSaveStatus('saved');

      // Clear "Saved" status after 2 seconds
      setTimeout(() => {
        if (this.saveStatus === 'saved') {
          this.updateSaveStatus('idle');
        }
      }, 2000);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[AutoSave] Save failed after ${duration}ms:`, error);
      this.updateSaveStatus('error');

      // Clear error status after 3 seconds
      setTimeout(() => {
        if (this.saveStatus === 'error') {
          this.updateSaveStatus('idle');
        }
      }, 3000);
    }
  }

  private updateSaveStatus(status: 'idle' | 'saving' | 'saved' | 'error'): void {
    this.saveStatus = status;
    const statusEl = this.querySelector('#save-status') as HTMLElement;

    if (!statusEl) return;

    const statusMessages = {
      idle: '',
      saving: '<span class="save-status-text saving">Saving...</span>',
      saved: '<span class="save-status-text saved">✓ Saved</span>',
      error: '<span class="save-status-text error">Failed to save</span>'
    };

    statusEl.innerHTML = statusMessages[status];
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
        console.log('Add link button clicked');
      });
    }

    if (locationBtn) {
      locationBtn.addEventListener('click', async () => {
        try {
          locationBtn.disabled = true;
          locationBtn.textContent = '⏳';
          await this.handleLocationCapture();
        } catch (error) {
          alert('Failed to get location. Please ensure location permissions are enabled.');
          console.error('Location error:', error);
        } finally {
          locationBtn.disabled = false;
          locationBtn.textContent = '📍';
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
              alert('Failed to add images. Please try again.');
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
      alert('Failed to remove image. Please try again.');
    });
  }
}
