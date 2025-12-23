import { WebComponent } from './WebComponent.js';
import { Entry } from '../models/Entry.js';
import { ValueType, EntityProperty } from '../types/index.js';
import { escapeHtml, extractUrls, replaceUrlsWithTitles, fetchUrlMetadata } from '../utils/helpers.js';
import { getValueTypeInputConfig } from '../config/valueTypeConfig.js';

/**
 * EntryEditForm Web Component for editing existing entries
 */
export class EntryEditFormComponent extends WebComponent {
    private entryId: string | null = null;
    private entry: Entry | null = null;
    private images: string[] = [];
    private hasUnsavedChanges: boolean = false;
    private autoSaveTimeout: number | null = null;

    connectedCallback(): void {
        this.unsubscribe = this.store.subscribe(() => {
            // Only re-render if entry is already set
            if (this.entry) {
                this.render();
            }
        });
        // Don't auto-render, wait for setEntry()
    }

    setEntry(entryId: string): void {
        this.entryId = entryId;
        const entries = this.store.getEntries();
        const foundEntry = entries.find(e => e.id === entryId);

        if (foundEntry) {
            this.entry = foundEntry;
            this.images = foundEntry.images ? [...foundEntry.images] : [];
            this.hasUnsavedChanges = false; // Reset when loading new entry
            this.render();
            this.attachEventListeners();
        } else {
            this.innerHTML = '<p>Entry not found</p>';
        }
    }

    render(): void {
        if (!this.entry) {
            this.innerHTML = '<p>Entry not found</p>';
            return;
        }

        const entity = this.store.getEntityById(this.entry.entityId);
        if (!entity) {
            this.innerHTML = '<p>Associated entity not found</p>';
            return;
        }

        // Get value input based on entity type (only if entity has valueType)
        const valueInputHtml = entity.valueType ? this.renderValueInput(entity.valueType, this.entry.value, entity.options) : '';

        this.innerHTML = `
            <form id="entry-edit-form">
                <div class="form-group">
                    <label>Entity</label>
                    <input type="text" value="${escapeHtml(entity.name)} (${entity.type})" disabled style="background: var(--background); color: var(--text-muted);">
                </div>

                <div id="value-input-container">
                    ${valueInputHtml}
                </div>

                <div id="properties-input-container">
                    ${entity.properties && entity.properties.length > 0 ? this.renderPropertyInputs(entity.properties, this.entry.propertyValues || {}) : ''}
                </div>

                <div class="form-group">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <label for="entry-notes" style="margin-bottom: 0;">Notes</label>
                        <button type="button" id="zen-mode-btn" class="btn-zen-mode" title="Zen mode (focus on writing)">🧘</button>
                    </div>
                    <textarea id="entry-notes" rows="3">${escapeHtml(this.entry.notes || '')}</textarea>
                </div>

                <input type="file" id="image-upload" accept="image/*" style="display: none;" multiple>
                <div id="image-preview" class="image-preview"></div>

                <div class="form-actions">
                    <div class="action-menu-buttons">
                        <div style="position: relative;">
                            <button type="button" id="image-menu-btn" class="btn-action-menu" title="Add images">📎</button>
                            <div id="image-menu" class="image-dropdown-menu" style="display: none;">
                                <div class="context-menu-item" id="upload-image-menu-item">📁 Upload Image</div>
                                <div class="context-menu-item" id="capture-image-menu-item">📷 Take Photo</div>
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

    private renderPropertyInputs(properties: EntityProperty[], propertyValues: Record<string, string | number | boolean>): string {
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
                            <span>${escapeHtml(prop.name)}${prop.required ? ' *' : ''}</span>
                        </label>
                    </div>
                `;
            }

            if (prop.valueType === 'select' && prop.options) {
                const valueStr = currentValue !== undefined ? String(currentValue) : '';
                return `
                    <div class="form-group">
                        <label for="${propId}">${escapeHtml(prop.name)}${prop.required ? ' *' : ''}</label>
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
                    <label for="${propId}">${escapeHtml(prop.name)}${prop.required ? ' *' : ''}</label>
                    <input ${attrs.filter(a => a).join(' ')}>
                </div>
            `;
        }).join('');
    }

    protected attachEventListeners(): void {
        const form = this.querySelector('#entry-edit-form') as HTMLFormElement;
        const imageMenuBtn = this.querySelector('#image-menu-btn') as HTMLButtonElement;
        const imageMenu = this.querySelector('#image-menu') as HTMLElement;
        const uploadMenuItem = this.querySelector('#upload-image-menu-item') as HTMLElement;
        const captureMenuItem = this.querySelector('#capture-image-menu-item') as HTMLElement;
        const fileInput = this.querySelector('#image-upload') as HTMLInputElement;
        const zenModeBtn = this.querySelector('#zen-mode-btn') as HTMLButtonElement;
        const zenModeClose = this.querySelector('#zen-mode-close') as HTMLButtonElement;

        if (form) {
            // Remove submit handler, we'll auto-save instead
            form.addEventListener('submit', (e) => {
                e.preventDefault(); // Prevent form submission
            });

            // Auto-save on form changes
            form.addEventListener('input', () => {
                this.scheduleAutoSave();
            });
            form.addEventListener('change', () => {
                this.scheduleAutoSave();
            });
        }

        if (zenModeBtn) {
            zenModeBtn.addEventListener('click', () => this.openZenMode());
        }

        if (zenModeClose) {
            zenModeClose.addEventListener('click', () => this.closeZenMode());
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
            const entity = this.store.getEntityById(this.entry.entityId);
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

            // Update the entry
            this.store.updateEntry(this.entryId, {
                value: value,
                notes: notes,
                images: this.images.length > 0 ? this.images : undefined,
                propertyValues: propertyValues
            });

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

            // Reset unsaved changes flag
            this.hasUnsavedChanges = false;

            // Don't close the panel for auto-save
            // URLStateManager.closePanel();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Error updating entry: ${message}`);
        }
    }

    private scheduleAutoSave(): void {
        // Clear existing timeout
        if (this.autoSaveTimeout !== null) {
            window.clearTimeout(this.autoSaveTimeout);
        }

        // Schedule auto-save after 500ms of inactivity
        this.autoSaveTimeout = window.setTimeout(() => {
            this.autoSave();
        }, 500);
    }

    private async autoSave(): Promise<void> {
        // Reuse the handleSubmit logic but without closing the panel
        const fakeEvent = new Event('submit');
        await this.handleSubmit(fakeEvent);
    }
}
