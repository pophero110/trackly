import { WebComponent } from './WebComponent.js';
import { Entry } from '../models/Entry.js';
import { ValueType, EntityProperty } from '../types/index.js';
import { escapeHtml, extractUrls, replaceUrlsWithTitles, fetchUrlMetadata } from '../utils/helpers.js';
import { URLStateManager } from '../utils/urlState.js';
import { getValueTypeInputConfig } from '../config/valueTypeConfig.js';

/**
 * EntryEditForm Web Component for editing existing entries
 */
export class EntryEditFormComponent extends WebComponent {
    private entryId: string | null = null;
    private entry: Entry | null = null;
    private images: string[] = [];
    private links: string[] = [];
    private linkTitles: Record<string, string> = {};
    private location: { latitude: number; longitude: number; name?: string } | null = null;
    private hasUnsavedChanges: boolean = false;

    connectedCallback(): void {
        this.unsubscribe = this.store.subscribe(() => {
            // If entry is already set, re-render
            if (this.entry) {
                this.render();
            } else if (this.entryId) {
                // If we have an entryId but no entry, try to load it again
                // (this handles the case where the component was initialized before data loaded)
                const entries = this.store.getEntries();
                const foundEntry = entries.find(e => e.id === this.entryId);
                if (foundEntry) {
                    this.entry = foundEntry;
                    this.images = foundEntry.images ? [...foundEntry.images] : [];
                    if (foundEntry.latitude !== undefined && foundEntry.longitude !== undefined) {
                        this.location = {
                            latitude: foundEntry.latitude,
                            longitude: foundEntry.longitude,
                            name: foundEntry.locationName
                        };
                    } else {
                        this.location = null;
                    }
                    this.hasUnsavedChanges = false;
                    this.render();
                    this.attachEventListeners();
                }
            }
        });
        // Don't auto-render, wait for setEntry()
    }

    setEntry(entryId: string): void {
        this.entryId = entryId;

        // Show loading state if data hasn't loaded yet
        if (!this.store.getIsLoaded()) {
            this.innerHTML = this.renderLoadingState('Loading entry...');
            // The connectedCallback subscription will handle rendering when data loads
            return;
        }

        this.initializeEntry(entryId);
    }

    private initializeEntry(entryId: string): void {
        const entries = this.store.getEntries();
        const foundEntry = entries.find(e => e.id === entryId);

        if (foundEntry) {
            this.entry = foundEntry;
            this.images = foundEntry.images ? [...foundEntry.images] : [];
            this.linkTitles = foundEntry.linkTitles ? { ...foundEntry.linkTitles } : {};
            // Initialize location from entry
            if (foundEntry.latitude !== undefined && foundEntry.longitude !== undefined) {
                this.location = {
                    latitude: foundEntry.latitude,
                    longitude: foundEntry.longitude,
                    name: foundEntry.locationName
                };
            } else {
                this.location = null;
            }
            this.hasUnsavedChanges = false;
            this.render();
            this.attachEventListeners();
        } else {
            this.innerHTML = '<p>Entry not found</p>';
        }
    }

    render(): void {
        if (!this.entry) {
            this.innerHTML = '<p>Loading...</p>';
            return;
        }

        const entity = this.store.getEntityById(this.entry.entityId);
        if (!entity) {
            this.innerHTML = '<p>Associated entity not found</p>';
            return;
        }

        // Get value input based on entity type (only if entity has valueType)
        const valueInputHtml = entity.valueType ? this.renderValueInput(entity.valueType, this.entry.value, entity.options) : '';

        // Get all entities for the dropdown
        const allEntities = this.store.getEntities();
        const entityOptionsHtml = allEntities.map(e => {
            const selected = e.id === entity.id ? 'selected' : '';
            return `<option value="${e.id}" ${selected}>${escapeHtml(e.name)} (${e.type})</option>`;
        }).join('');

        this.innerHTML = `
            <form id="entry-edit-form">
                <div class="form-group">
                    <label for="entry-entity">Entity</label>
                    <select id="entry-entity">
                        ${entityOptionsHtml}
                    </select>
                </div>

                <div id="value-input-container">
                    ${valueInputHtml}
                </div>

                <div id="properties-input-container">
                    ${entity.properties && entity.properties.length > 0 ? this.renderPropertyInputs(entity.properties, this.entry.propertyValues || {}) : ''}
                </div>

                <div class="form-group">
                    <label for="entry-timestamp">Time</label>
                    <input type="datetime-local" id="entry-timestamp" value="${this.formatTimestampForInput(this.entry.timestamp)}">
                </div>

                <div class="form-group">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <label for="entry-notes" style="margin-bottom: 0;">Notes</label>
                        <button type="button" id="zen-mode-btn" class="btn-zen-mode" title="Zen mode (focus on writing)">🧘</button>
                    </div>
                    <textarea id="entry-notes" rows="5">${escapeHtml(this.entry.notes || '')}</textarea>
                </div>

                <input type="file" id="image-upload" accept="image/*" style="display: none;" multiple>
                <div id="image-preview" class="image-preview"></div>

                <div id="link-input-container" class="link-input-container" style="display: none;">
                    <input type="url" id="link-input" class="link-input" placeholder="https://example.com" pattern="https?://.+" />
                    <button type="button" id="add-link-btn-action" class="btn-insert-link">Add</button>
                    <button type="button" id="cancel-link-btn" class="btn-cancel-link">×</button>
                </div>

                ${this.renderLinksDisplay()}

                <div id="location-display" class="location-display" style="display: ${this.location ? 'flex' : 'none'};">
                    <span class="location-icon">📍</span>
                    <span id="location-text" class="location-text">${this.location?.name || (this.location ? `${this.location.latitude.toFixed(4)}, ${this.location.longitude.toFixed(4)}` : '')}</span>
                    <button type="button" id="remove-location-btn" class="btn-remove-location">×</button>
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Update Entry</button>
                    <div class="action-menu-buttons">
                        <button type="button" id="location-btn" class="btn-action-menu" title="Add location">📍</button>
                        <button type="button" id="add-link-btn" class="btn-action-menu" title="Add link to notes">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                            </svg>
                        </button>
                        <div style="position: relative;">
                            <button type="button" id="image-menu-btn" class="btn-action-menu" title="Add images">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                    <polyline points="21 15 16 10 5 21"></polyline>
                                </svg>
                            </button>
                            <div id="image-menu" class="image-dropdown-menu" style="display: none;">
                                <div class="context-menu-item" id="upload-image-menu-item">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="17 8 12 3 7 8"></polyline>
                                        <line x1="12" y1="3" x2="12" y2="15"></line>
                                    </svg>
                                    <span>Upload Image</span>
                                </div>
                                <div class="context-menu-item" id="capture-image-menu-item">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                        <circle cx="12" cy="13" r="4"></circle>
                                    </svg>
                                    <span>Take Photo</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>

            <div id="zen-mode-overlay" class="zen-mode-overlay" style="display: none;">
                <div class="zen-mode-container">
                    <div class="zen-mode-header">
                        <span class="zen-mode-title">Notes</span>
                        <button type="button" id="zen-mode-close" class="btn-zen-close" title="Exit zen mode (Esc)">✕</button>
                    </div>
                    <div class="zen-mode-editor">
                        <div id="zen-line-numbers" class="zen-line-numbers"></div>
                        <textarea id="zen-mode-textarea" class="zen-mode-textarea" placeholder="Write your notes here..."></textarea>
                    </div>
                </div>
            </div>
        `;

        // Render existing images
        this.renderImagePreview();
    }

    private renderValueInput(valueType: ValueType, currentValue?: string | number | boolean, entityOptions?: Array<{value: string; label: string}>): string {
        const valueStr = currentValue !== undefined ? String(currentValue) : '';
        const config = getValueTypeInputConfig(valueType);

        if (config.inputType === 'select') {
            // Use entity options if provided, otherwise use config options
            const options = entityOptions || config.options || [];
            const optionsHtml = [
                '<option value="">Select...</option>',
                ...options.map(opt => {
                    const selected = opt.value === valueStr ? 'selected' : '';
                    return `<option value="${opt.value}" ${selected}>${escapeHtml(opt.label)}</option>`;
                })
            ].join('');

            return `
                <div class="form-group">
                    <label for="entry-value">${escapeHtml(config.label)} *</label>
                    <select id="entry-value" required>
                        ${optionsHtml}
                    </select>
                </div>
            `;
        }

        if (config.inputType === 'checkbox') {
            const isChecked = currentValue === true || currentValue === 'true';
            return `
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="entry-value" value="true" ${isChecked ? 'checked' : ''}>
                        <span>${escapeHtml(config.label)}</span>
                    </label>
                </div>
            `;
        }

        if (config.inputType === 'range') {
            const rangeValue = currentValue !== undefined ? String(currentValue) : String(config.min || 0);
            return `
                <div class="form-group">
                    <label for="entry-value">${escapeHtml(config.label)} *</label>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <input type="range" id="entry-value" min="${config.min || 0}" max="${config.max || 100}" step="${config.step || 1}" value="${rangeValue}" style="flex: 1;" required>
                        <span id="range-value-display" style="min-width: 3rem; text-align: right; font-weight: 500;">${rangeValue}</span>
                    </div>
                </div>
            `;
        }

        // Build input attributes
        const attrs: string[] = [
            `type="${config.inputType}"`,
            'id="entry-value"',
            'required'
        ];

        // Add value for all input types
        // Text-based inputs need escaping
        if (config.inputType === 'text' || config.inputType === 'url' || config.inputType === 'email' ||
            config.inputType === 'tel' || config.inputType === 'date' || config.inputType === 'time' ||
            config.inputType === 'datetime-local' || config.inputType === 'month' || config.inputType === 'week' ||
            config.inputType === 'color') {
            attrs.push(`value="${escapeHtml(valueStr)}"`);
        } else {
            // Number and range inputs don't need escaping
            attrs.push(`value="${valueStr}"`);
        }

        if (config.placeholder) {
            attrs.push(`placeholder="${escapeHtml(config.placeholder)}"`);
        }
        if (config.min !== undefined) {
            attrs.push(`min="${config.min}"`);
        }
        if (config.max !== undefined) {
            attrs.push(`max="${config.max}"`);
        }
        if (config.step !== undefined) {
            attrs.push(`step="${config.step}"`);
        }

        return `
            <div class="form-group">
                <label for="entry-value">${escapeHtml(config.label)} *</label>
                <input ${attrs.join(' ')}>
            </div>
        `;
    }

    private formatTimestampForInput(timestamp: string): string {
        // Convert ISO 8601 timestamp (e.g., "2025-12-31T19:59:09.000Z")
        // to datetime-local format in local timezone (e.g., "2025-12-31T19:59")
        // Use format without seconds for iOS Safari compatibility
        const date = new Date(timestamp);
        // Adjust for timezone offset to get local time
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    }

    private renderPropertyInputs(properties: EntityProperty[], propertyValues: Record<string, string | number | boolean>): string {
        const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

        return properties.map(prop => {
            const config = getValueTypeInputConfig(prop.valueType);
            const propId = `property-${prop.id}`;
            const requiredAttr = prop.required ? 'required' : '';
            const currentValue = propertyValues[prop.id];

            if (config.inputType === 'checkbox') {
                const isChecked = currentValue === true || currentValue === 'true';
                return `
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="${propId}" value="true" ${isChecked ? 'checked' : ''}>
                            <span>${escapeHtml(capitalizeFirstLetter(prop.name))}${prop.required ? ' *' : ''}</span>
                        </label>
                    </div>
                `;
            }

            if (prop.valueType === 'select' && prop.options) {
                const valueStr = currentValue !== undefined ? String(currentValue) : '';
                return `
                    <div class="form-group">
                        <label for="${propId}">${escapeHtml(capitalizeFirstLetter(prop.name))}${prop.required ? ' *' : ''}</label>
                        <select id="${propId}" ${requiredAttr}>
                            <option value="">Select...</option>
                            ${prop.options.map(opt => `<option value="${escapeHtml(opt.value)}" ${opt.value === valueStr ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`).join('')}
                        </select>
                    </div>
                `;
            }

            const valueStr = currentValue !== undefined ? String(currentValue) : '';
            const attrs: string[] = [
                `type="${config.inputType}"`,
                `id="${propId}"`,
                requiredAttr
            ];

            // Add value attribute
            if (config.inputType === 'text' || config.inputType === 'url' || config.inputType === 'email' ||
                config.inputType === 'tel' || config.inputType === 'date' || config.inputType === 'time') {
                attrs.push(`value="${escapeHtml(valueStr)}"`);
            } else {
                attrs.push(`value="${valueStr}"`);
            }

            if (config.placeholder) {
                attrs.push(`placeholder="${escapeHtml(config.placeholder)}"`);
            }
            if (config.min !== undefined) {
                attrs.push(`min="${config.min}"`);
            }
            if (config.max !== undefined) {
                attrs.push(`max="${config.max}"`);
            }
            if (config.step !== undefined) {
                attrs.push(`step="${config.step}"`);
            }

            return `
                <div class="form-group">
                    <label for="${propId}">${escapeHtml(capitalizeFirstLetter(prop.name))}${prop.required ? ' *' : ''}</label>
                    <input ${attrs.filter(a => a).join(' ')}>
                </div>
            `;
        }).join('');
    }

    protected attachEventListeners(): void {
        const form = this.querySelector('#entry-edit-form') as HTMLFormElement;
        const entitySelect = this.querySelector('#entry-entity') as HTMLSelectElement;
        const imageMenuBtn = this.querySelector('#image-menu-btn') as HTMLButtonElement;
        const imageMenu = this.querySelector('#image-menu') as HTMLElement;
        const uploadMenuItem = this.querySelector('#upload-image-menu-item') as HTMLElement;
        const captureMenuItem = this.querySelector('#capture-image-menu-item') as HTMLElement;
        const fileInput = this.querySelector('#image-upload') as HTMLInputElement;
        const zenModeBtn = this.querySelector('#zen-mode-btn') as HTMLButtonElement;
        const zenModeClose = this.querySelector('#zen-mode-close') as HTMLButtonElement;
        const addLinkBtn = this.querySelector('#add-link-btn') as HTMLButtonElement;
        const linkInputContainer = this.querySelector('#link-input-container') as HTMLElement;
        const linkInput = this.querySelector('#link-input') as HTMLInputElement;
        const addLinkBtnAction = this.querySelector('#add-link-btn-action') as HTMLButtonElement;
        const cancelLinkBtn = this.querySelector('#cancel-link-btn') as HTMLButtonElement;

        // Handle entity change - update value and property inputs
        if (entitySelect) {
            entitySelect.addEventListener('change', () => {
                this.handleEntityChange(entitySelect.value);
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));

            // Track form changes
            form.addEventListener('input', () => {
                this.hasUnsavedChanges = true;
            });
            form.addEventListener('change', () => {
                this.hasUnsavedChanges = true;
            });

            // Add Cmd+Enter keyboard shortcut to submit
            form.addEventListener('keydown', (e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    form.requestSubmit();
                }
            });
        }

        if (zenModeBtn) {
            zenModeBtn.addEventListener('click', () => this.openZenMode());
        }

        if (zenModeClose) {
            zenModeClose.addEventListener('click', () => this.closeZenMode());
        }

        if (addLinkBtn && linkInputContainer) {
            addLinkBtn.addEventListener('click', () => this.showLinkInput());
        }

        if (addLinkBtnAction && linkInput) {
            addLinkBtnAction.addEventListener('click', () => this.addLink(linkInput.value));
        }

        if (cancelLinkBtn && linkInputContainer) {
            cancelLinkBtn.addEventListener('click', () => this.hideLinkInput());
        }

        if (linkInput) {
            // Handle Enter key to add link
            linkInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addLink(linkInput.value);
                }
                if (e.key === 'Escape') {
                    this.hideLinkInput();
                }
            });
        }

        // Attach remove link handlers
        this.querySelectorAll('.btn-remove-link').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt((e.target as HTMLElement).dataset.index || '0');
                this.removeLink(index);
            });
        });

        // Tab key handling for note textareas
        const notesTextarea = this.querySelector('#entry-notes') as HTMLTextAreaElement;
        const zenTextarea = this.querySelector('#zen-mode-textarea') as HTMLTextAreaElement;

        const handleTabKey = (e: KeyboardEvent) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const textarea = e.target as HTMLTextAreaElement;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const value = textarea.value;

                // Insert tab (2 spaces)
                textarea.value = value.substring(0, start) + '  ' + value.substring(end);

                // Move cursor after the inserted tab
                textarea.selectionStart = textarea.selectionEnd = start + 2;
            }
        };

        if (notesTextarea) {
            notesTextarea.addEventListener('keydown', handleTabKey);
        }

        if (zenTextarea) {
            zenTextarea.addEventListener('keydown', handleTabKey);
        }

        // Image menu handlers
        if (imageMenuBtn && imageMenu) {
            imageMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = imageMenu.style.display === 'block';

                if (!isVisible) {
                    // Position the menu above the button with right edge aligned to button's right edge
                    const rect = imageMenuBtn.getBoundingClientRect();

                    // Temporarily show menu to get its dimensions
                    imageMenu.style.visibility = 'hidden';
                    imageMenu.style.display = 'block';
                    const menuHeight = imageMenu.offsetHeight;
                    const menuWidth = imageMenu.offsetWidth;
                    imageMenu.style.visibility = 'visible';

                    imageMenu.style.top = `${rect.top - menuHeight - 4}px`;
                    imageMenu.style.left = `${rect.right - menuWidth}px`;
                } else {
                    imageMenu.style.display = 'none';
                }
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (imageMenu.style.display === 'block' &&
                    !imageMenu.contains(e.target as Node) &&
                    e.target !== imageMenuBtn) {
                    imageMenu.style.display = 'none';
                }
            });
        }

        if (uploadMenuItem) {
            uploadMenuItem.addEventListener('click', () => {
                fileInput?.click();
                if (imageMenu) imageMenu.style.display = 'none';
            });
        }

        if (captureMenuItem) {
            captureMenuItem.addEventListener('click', () => {
                this.handleCameraCapture();
                if (imageMenu) imageMenu.style.display = 'none';
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleImageUpload(e));
        }

        // Location button handler
        const locationBtn = this.querySelector('#location-btn') as HTMLButtonElement;
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

        // Remove location handler
        const removeLocationBtn = this.querySelector('#remove-location-btn') as HTMLButtonElement;
        if (removeLocationBtn) {
            removeLocationBtn.addEventListener('click', () => {
                this.location = null;
                this.hasUnsavedChanges = true;
                this.render();
                this.attachEventListeners();
            });
        }

        // Attach range input listener
        this.attachRangeListener();

        // Attach paste handler for notes textarea
        this.attachNotesAreaPasteHandler();
    }

    private attachRangeListener(): void {
        const rangeInput = this.querySelector('#entry-value[type="range"]') as HTMLInputElement;
        const rangeDisplay = this.querySelector('#range-value-display');

        if (rangeInput && rangeDisplay) {
            rangeInput.addEventListener('input', () => {
                rangeDisplay.textContent = rangeInput.value;
            });
        }
    }

    private attachNotesAreaPasteHandler(): void {
        const notesArea = this.querySelector('#entry-notes') as HTMLTextAreaElement;

        if (notesArea) {
            notesArea.addEventListener('paste', (e) => this.handleNotesPaste(e));
        }
    }

    private handleNotesPaste(e: ClipboardEvent): void {
        const items = e.clipboardData?.items;
        if (!items) return;

        // Check if clipboard contains images
        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            if (item.type.startsWith('image/')) {
                e.preventDefault(); // Prevent default paste of image data as text

                const file = item.getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const result = event.target?.result as string;
                        this.images.push(result);
                        this.renderImagePreview();
                    };
                    reader.readAsDataURL(file);
                }
            }
        }
    }

    private handleImageUpload(e: Event): void {
        const input = e.target as HTMLInputElement;
        const files = input.files;

        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const result = e.target?.result as string;
                    this.images.push(result);
                    this.renderImagePreview();
                };
                reader.readAsDataURL(file);
            }
        });

        // Reset input
        input.value = '';
    }

    private async handleCameraCapture(): Promise<void> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false
            });

            // Create video element for camera preview
            const modal = document.createElement('div');
            modal.className = 'camera-modal';
            modal.innerHTML = `
                <div class="camera-container">
                    <video id="camera-video" autoplay playsinline></video>
                    <canvas id="camera-canvas" style="display: none;"></canvas>
                    <div class="camera-controls">
                        <button type="button" class="btn btn-primary" id="take-photo-btn">📸 Capture</button>
                        <button type="button" class="btn btn-secondary" id="cancel-camera-btn">Cancel</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const video = modal.querySelector('#camera-video') as HTMLVideoElement;
            const canvas = modal.querySelector('#camera-canvas') as HTMLCanvasElement;
            const takePhotoBtn = modal.querySelector('#take-photo-btn') as HTMLButtonElement;
            const cancelBtn = modal.querySelector('#cancel-camera-btn') as HTMLButtonElement;

            video.srcObject = stream;

            const cleanup = () => {
                stream.getTracks().forEach(track => track.stop());
                document.body.removeChild(modal);
            };

            takePhotoBtn.addEventListener('click', () => {
                // Set canvas dimensions to match video
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                // Draw video frame to canvas
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(video, 0, 0);

                // Convert to base64
                const imageData = canvas.toDataURL('image/jpeg', 0.8);
                this.images.push(imageData);
                this.renderImagePreview();

                cleanup();
            });

            cancelBtn.addEventListener('click', cleanup);

        } catch (error) {
            console.error('Camera access error:', error);
            alert('Unable to access camera. Please check permissions or use the upload option.');
        }
    }

    private renderImagePreview(): void {
        const previewContainer = this.querySelector('#image-preview');
        if (!previewContainer) return;

        if (this.images.length === 0) {
            previewContainer.innerHTML = '';
            return;
        }

        previewContainer.innerHTML = this.images.map((img, index) => `
            <div class="image-preview-item">
                <img src="${img}" alt="Preview ${index + 1}">
                <button type="button" class="btn-remove-image" data-index="${index}">×</button>
            </div>
        `).join('');

        // Attach remove handlers
        previewContainer.querySelectorAll('.btn-remove-image').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt((e.target as HTMLElement).dataset.index || '0');
                this.images.splice(index, 1);
                this.renderImagePreview();
            });
        });
    }

    private async processTextWithUrls(entryId: string, text: string, field: 'value' | 'notes'): Promise<void> {
        try {
            const urls = extractUrls(text);
            if (urls.length === 0) return;

            const result = await replaceUrlsWithTitles(text);
            if (result.text !== text) {
                const updates: Partial<{ value?: string; notes?: string }> = {};
                if (field === 'value') {
                    updates.value = result.text;
                } else {
                    updates.notes = result.text;
                }
                this.store.updateEntry(entryId, updates);
            }
        } catch (error) {
            console.error('Failed to process URLs in text:', error);
        }
    }

    private isUrl(text: string): boolean {
        // Check if it starts with www.
        if (text.startsWith('www.')) {
            return true;
        }

        // Check if it's a valid URL with http(s) protocol
        try {
            const url = new URL(text);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }

    private async fetchPropertyUrlTitles(entryId: string, properties: EntityProperty[], propertyValues: Record<string, string | number | boolean>): Promise<void> {
        try {
            const propertyValueDisplays: Record<string, string> = {};
            const fetchPromises: Promise<void>[] = [];

            properties.forEach(prop => {
                if (prop.valueType === 'url' && propertyValues[prop.id]) {
                    const url = String(propertyValues[prop.id]);
                    if (this.isUrl(url)) {
                        // Normalize www URLs to include https://
                        const normalizedUrl = url.startsWith('www.') ? 'https://' + url : url;
                        const promise = fetchUrlMetadata(normalizedUrl).then(metadata => {
                            if (metadata.title && metadata.title !== normalizedUrl) {
                                propertyValueDisplays[prop.id] = metadata.title;
                            }
                        }).catch(error => {
                            console.error(`Failed to fetch title for property ${prop.name}:`, error);
                        });
                        fetchPromises.push(promise);
                    }
                }
            });

            // Wait for all fetches to complete
            await Promise.all(fetchPromises);

            // Update entry if we fetched any titles
            if (Object.keys(propertyValueDisplays).length > 0) {
                this.store.updateEntry(entryId, { propertyValueDisplays });
            }
        } catch (error) {
            console.error('Failed to fetch property URL titles:', error);
        }
    }

    private async fetchLinkTitles(entryId: string, links: string[]): Promise<void> {
        try {
            // Get existing linkTitles from the entry
            const entry = this.store.getEntryById(entryId);
            const existingTitles = entry?.linkTitles || {};
            const linkTitles: Record<string, string> = { ...existingTitles };
            const fetchPromises: Promise<void>[] = [];

            links.forEach(url => {
                // Skip if we already have a title for this URL
                if (existingTitles[url]) {
                    return;
                }

                const promise = fetchUrlMetadata(url).then(metadata => {
                    if (metadata.title && metadata.title !== url) {
                        linkTitles[url] = metadata.title;
                    }
                }).catch(error => {
                    console.error(`Failed to fetch title for link ${url}:`, error);
                });
                fetchPromises.push(promise);
            });

            await Promise.all(fetchPromises);

            if (Object.keys(linkTitles).length > 0) {
                this.store.updateEntry(entryId, { linkTitles });
            }
        } catch (error) {
            console.error('Failed to fetch link titles:', error);
        }
    }

    private updateZenLineNumbers(): void {
        const zenTextarea = this.querySelector('#zen-mode-textarea') as HTMLTextAreaElement;
        const lineNumbers = this.querySelector('#zen-line-numbers') as HTMLElement;

        if (!zenTextarea || !lineNumbers) return;

        const lines = zenTextarea.value.split('\n');
        const lineCount = lines.length;

        // Get textarea's computed styles for accurate measurement
        const textareaStyles = window.getComputedStyle(zenTextarea);
        const width = zenTextarea.clientWidth - parseFloat(textareaStyles.paddingLeft) - parseFloat(textareaStyles.paddingRight);
        const computedLineHeight = parseFloat(textareaStyles.lineHeight);

        // Create a hidden div to measure wrapped line heights
        let measuringDiv = document.getElementById('zen-line-measurer') as HTMLDivElement;
        if (!measuringDiv) {
            measuringDiv = document.createElement('div');
            measuringDiv.id = 'zen-line-measurer';
            document.body.appendChild(measuringDiv);
        }

        // Update measuring div styles to match textarea
        measuringDiv.style.cssText = `
            position: absolute;
            visibility: hidden;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
            font-family: ${textareaStyles.fontFamily};
            font-size: ${textareaStyles.fontSize};
            line-height: ${textareaStyles.lineHeight};
            padding: 0;
            width: ${width}px;
        `;

        // Generate line numbers with proper positioning
        let html = '';
        let previousLineHeight = 0;

        for (let i = 0; i < lineCount; i++) {
            const lineText = lines[i] || ' '; // Use space for empty lines
            measuringDiv.textContent = lineText;
            const lineVisualHeight = measuringDiv.offsetHeight;

            // Position line number at the start of each logical line
            // First line has no margin, subsequent lines use previous line's height as margin
            if (i === 0) {
                html += `<div>${i + 1}</div>`;
            } else {
                // Subtract the natural line number height to prevent double-spacing
                const marginTop = previousLineHeight - computedLineHeight;
                html += `<div style="margin-top: ${marginTop}px;">${i + 1}</div>`;
            }

            previousLineHeight = lineVisualHeight;
        }

        lineNumbers.innerHTML = html;

        // Sync scroll
        lineNumbers.scrollTop = zenTextarea.scrollTop;
    }

    private openZenMode(): void {
        const notesTextarea = this.querySelector('#entry-notes') as HTMLTextAreaElement;
        const zenOverlay = this.querySelector('#zen-mode-overlay') as HTMLElement;
        const zenTextarea = this.querySelector('#zen-mode-textarea') as HTMLTextAreaElement;

        if (!notesTextarea || !zenOverlay || !zenTextarea) return;

        // Copy content to zen mode textarea
        zenTextarea.value = notesTextarea.value;

        // Show zen mode overlay
        zenOverlay.style.display = 'flex';

        // Update line numbers
        this.updateZenLineNumbers();

        // Add event listeners for line number updates
        zenTextarea.addEventListener('input', () => this.updateZenLineNumbers());
        zenTextarea.addEventListener('scroll', () => {
            const lineNumbers = this.querySelector('#zen-line-numbers') as HTMLElement;
            if (lineNumbers) {
                lineNumbers.scrollTop = zenTextarea.scrollTop;
            }
        });

        // Focus on zen mode textarea
        setTimeout(() => zenTextarea.focus(), 100);

        // Add escape key listener with stopPropagation to prevent closing the modal
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.closeZenMode();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape, true);
    }

    private closeZenMode(): void {
        const notesTextarea = this.querySelector('#entry-notes') as HTMLTextAreaElement;
        const zenOverlay = this.querySelector('#zen-mode-overlay') as HTMLElement;
        const zenTextarea = this.querySelector('#zen-mode-textarea') as HTMLTextAreaElement;

        if (!notesTextarea || !zenOverlay || !zenTextarea) return;

        // Copy content back to notes textarea
        notesTextarea.value = zenTextarea.value;

        // Hide zen mode overlay
        zenOverlay.style.display = 'none';
    }

    private async handleLocationCapture(): Promise<void> {
        // Request geolocation permission and get current position
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });

        this.location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        };

        // Reverse geocode to get location name
        const locationName = await this.reverseGeocode(position.coords.latitude, position.coords.longitude);
        if (locationName) {
            this.location.name = locationName;
        }

        this.hasUnsavedChanges = true;

        // Re-render to show location
        this.render();
        this.attachEventListeners();
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

    private handleEntityChange(newEntityId: string): void {
        const newEntity = this.store.getEntityById(newEntityId);
        if (!newEntity) return;

        // Update value input container
        const valueContainer = this.querySelector('#value-input-container');
        if (valueContainer) {
            const valueInputHtml = newEntity.valueType ? this.renderValueInput(newEntity.valueType, undefined, newEntity.options) : '';
            valueContainer.innerHTML = valueInputHtml;
            this.attachRangeListener();
        }

        // Update properties input container
        const propertiesContainer = this.querySelector('#properties-input-container');
        if (propertiesContainer) {
            const propertiesHtml = newEntity.properties && newEntity.properties.length > 0
                ? this.renderPropertyInputs(newEntity.properties, {})
                : '';
            propertiesContainer.innerHTML = propertiesHtml;
        }
    }

    public checkUnsavedChanges(): boolean {
        if (this.hasUnsavedChanges) {
            return confirm('You have unsaved changes. Are you sure you want to close without saving?');
        }
        return true;
    }

    private async handleSubmit(e: Event): Promise<void> {
        e.preventDefault();

        if (!this.entry || !this.entryId) {
            return;
        }

        try {
            // Get the selected entity (may be different from original)
            const entitySelect = this.querySelector('#entry-entity') as HTMLSelectElement;
            const selectedEntityId = entitySelect ? entitySelect.value : this.entry.entityId;
            const entity = this.store.getEntityById(selectedEntityId);
            if (!entity) {
                throw new Error('Entity not found');
            }

            // Get value based on valueType (only if entity has valueType)
            let value: string | number | boolean | undefined;
            const valueInput = this.querySelector('#entry-value') as HTMLInputElement;

            if (valueInput && entity.valueType) {
                switch (entity.valueType) {
                    // Number types
                    case 'number':
                    case 'duration':
                    case 'rating':
                    case 'range':
                        value = parseFloat(valueInput.value);
                        break;

                    // Boolean
                    case 'checkbox':
                        value = (valueInput as HTMLInputElement).checked;
                        break;

                    // Text types
                    case 'text':
                    case 'email':
                    case 'tel':
                        value = valueInput.value;
                        break;

                    // Date/Time types
                    case 'date':
                    case 'time':
                    case 'datetime-local':
                    case 'month':
                    case 'week':
                        value = valueInput.value;
                        break;

                    // Color
                    case 'color':
                        value = valueInput.value;
                        break;

                    // Select
                    case 'select':
                        value = valueInput.value;
                        break;

                    // URL-based types
                    case 'url':
                    case 'image':
                    case 'audio':
                    case 'video':
                    case 'hyperlink':
                        value = valueInput.value;
                        break;
                }
            }

            const notes = (this.querySelector('#entry-notes') as HTMLTextAreaElement).value;
            // Get timestamp and convert to ISO format
            const timestampInput = (this.querySelector('#entry-timestamp') as HTMLInputElement).value;
            const timestamp = timestampInput ? new Date(timestampInput).toISOString() : this.entry.timestamp;

            // Collect property values
            let propertyValues: Record<string, string | number | boolean> | undefined;
            if (entity.properties && entity.properties.length > 0) {
                propertyValues = {};
                entity.properties.forEach(prop => {
                    const input = this.querySelector(`#property-${prop.id}`) as HTMLInputElement;
                    if (input) {
                        if (prop.valueType === 'checkbox') {
                            propertyValues![prop.id] = input.checked;
                        } else if (prop.valueType === 'number' || prop.valueType === 'duration' || prop.valueType === 'rating') {
                            propertyValues![prop.id] = parseFloat(input.value) || 0;
                        } else {
                            propertyValues![prop.id] = input.value;
                        }
                    }
                });
            }

            // Extract URLs from notes and combine with manually added links
            const notesUrls = extractUrls(notes || '');
            const manualLinks = this.entry.links || [];
            const allLinks = [...manualLinks, ...notesUrls];
            // Remove duplicates
            const uniqueLinks = Array.from(new Set(allLinks));

            // Update the entry (include entityId and entityName if changed)
            const updates: any = {
                timestamp: timestamp,
                value: value,
                notes: notes,
                images: this.images, // Send empty array to remove all images
                links: uniqueLinks, // Include all unique links
                linkTitles: Object.keys(this.linkTitles).length > 0 ? { ...this.linkTitles } : undefined,
                propertyValues: propertyValues,
                latitude: this.location?.latitude,
                longitude: this.location?.longitude,
                locationName: this.location?.name
            };

            // Add entityId and entityName if entity was changed
            if (selectedEntityId !== this.entry.entityId) {
                updates.entityId = selectedEntityId;
                updates.entityName = entity.name;
            }

            this.store.updateEntry(this.entryId, updates);

            // Process URLs asynchronously in text fields
            if (value && typeof value === 'string' && entity.valueType === 'text') {
                this.processTextWithUrls(this.entryId, value, 'value');
            }
            if (notes && notes.trim()) {
                this.processTextWithUrls(this.entryId, notes, 'notes');
            }

            // Fetch titles for URL-type properties
            if (entity.properties && entity.properties.length > 0 && propertyValues) {
                this.fetchPropertyUrlTitles(this.entryId, entity.properties, propertyValues);
            }

            // Fetch titles for links
            if (uniqueLinks.length > 0) {
                this.fetchLinkTitles(this.entryId, uniqueLinks);
            }

            // Reset unsaved changes flag
            this.hasUnsavedChanges = false;

            // Close the panel
            URLStateManager.closePanel();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            alert(`Error updating entry: ${message}`);
        }
    }

    private showLinkInput(): void {
        const linkInputContainer = this.querySelector('#link-input-container') as HTMLElement;
        const linkInput = this.querySelector('#link-input') as HTMLInputElement;

        if (linkInputContainer && linkInput) {
            linkInputContainer.style.display = 'flex';
            linkInput.value = '';
            linkInput.focus();
        }
    }

    private hideLinkInput(): void {
        const linkInputContainer = this.querySelector('#link-input-container') as HTMLElement;
        const linkInput = this.querySelector('#link-input') as HTMLInputElement;

        if (linkInputContainer && linkInput) {
            linkInputContainer.style.display = 'none';
            linkInput.value = '';
        }
    }

    private async addLink(url: string): Promise<void> {
        const linkInput = this.querySelector('#link-input') as HTMLInputElement;

        const trimmedUrl = url?.trim() || '';

        // Check if empty
        if (!trimmedUrl) {
            alert('Please enter a URL');
            return;
        }

        // Check HTML5 validity
        if (linkInput && !linkInput.checkValidity()) {
            linkInput.reportValidity();
            return;
        }

        // Add the URL to entry's links array
        if (!this.entry.links) {
            this.entry.links = [];
        }
        this.entry.links.push(trimmedUrl);

        // Mark as having unsaved changes
        this.hasUnsavedChanges = true;

        // Re-render to show the new link (initially shows URL)
        this.render();
        this.attachEventListeners();

        // Hide the link input
        this.hideLinkInput();

        // Fetch title asynchronously
        try {
            const metadata = await fetchUrlMetadata(trimmedUrl);
            if (metadata.title && metadata.title !== trimmedUrl) {
                this.linkTitles[trimmedUrl] = metadata.title;
                // Re-render to show the title
                this.render();
                this.attachEventListeners();
            }
        } catch (error) {
            console.error(`Failed to fetch title for link ${trimmedUrl}:`, error);
            // Keep showing the URL if title fetch fails
        }
    }

    private removeLink(index: number): void {
        if (this.entry.links) {
            this.entry.links.splice(index, 1);
            this.hasUnsavedChanges = true;
            this.render();
            this.attachEventListeners();
        }
    }

    private renderLinksDisplay(): string {
        if (!this.entry.links || this.entry.links.length === 0) {
            return '';
        }

        const linksHtml = this.entry.links.map((link, index) => {
            // Use title if available, otherwise show URL
            const displayText = this.linkTitles[link] || link;
            return `
            <div class="link-item">
                <a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" class="link-url" title="${escapeHtml(link)}">${escapeHtml(displayText)}</a>
                <button type="button" class="btn-remove-link" data-index="${index}">×</button>
            </div>
        `}).join('');

        return `<div class="links-display"><div class="links-container">${linksHtml}</div></div>`;
    }
}
