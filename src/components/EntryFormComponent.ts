import { WebComponent } from './WebComponent.js';
import { Entry } from '../models/Entry.js';
import { EntryFormData, ValueType, EntityProperty } from '../types/index.js';
import { getCurrentTimestamp, escapeHtml, fetchUrlMetadata, extractUrls, replaceUrlsWithTitles } from '../utils/helpers.js';
import { URLStateManager } from '../utils/urlState.js';
import { getValueTypeInputConfig } from '../config/valueTypeConfig.js';

/**
 * EntryForm Web Component for logging new entries
 */
export class EntryFormComponent extends WebComponent {
    private images: string[] = [];

    render(): void {
        const entities = this.store.getEntities();
        const selectedEntityId = this.store.getSelectedEntityId();

        const entitiesOptions = entities
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(entity => `<option value="${entity.id}" ${entity.id === selectedEntityId ? 'selected' : ''}>${escapeHtml(entity.name)} (${entity.type})</option>`)
            .join('');

        // Get selected entity to show appropriate value input
        const selectedEntity = selectedEntityId ? this.store.getEntityById(selectedEntityId) : null;
        const valueInputHtml = selectedEntity && selectedEntity.valueType ? this.renderValueInput(selectedEntity.valueType, selectedEntity.options) : '';

        this.innerHTML = `
            <form id="entry-form">
                <div class="form-group">
                    <label for="entry-entity">Select Entity *</label>
                    <select id="entry-entity" required>
                        <option value="">Select entity...</option>
                        ${entitiesOptions}
                    </select>
                </div>

                <div id="value-input-container">
                    ${valueInputHtml}
                </div>

                <div id="properties-input-container">
                    ${selectedEntity && selectedEntity.properties && selectedEntity.properties.length > 0 ? this.renderPropertyInputs(selectedEntity.properties) : ''}
                </div>

                <div class="form-group">
                    <label for="entry-notes">Notes (optional)</label>
                    <textarea id="entry-notes" rows="3"></textarea>
                </div>

                <div class="form-group">
                    <label>Images (optional)</label>
                    <div class="image-controls">
                        <input type="file" id="image-upload" accept="image/*" style="display: none;" multiple>
                        <button type="button" class="btn btn-secondary" id="upload-image-btn">📁 Upload Image</button>
                        <button type="button" class="btn btn-secondary" id="capture-image-btn">📷 Take Photo</button>
                    </div>
                    <div id="image-preview" class="image-preview"></div>
                </div>

                <button type="submit" class="btn btn-primary">Log Entry</button>
            </form>
        `;

        this.attachEventListeners();
    }

    private renderValueInput(valueType: ValueType, entityOptions?: Array<{value: string; label: string}>): string {
        const config = getValueTypeInputConfig(valueType);

        if (config.inputType === 'select') {
            // Use entity options if provided, otherwise use config options
            const options = entityOptions || config.options || [];
            const optionsHtml = [
                '<option value="">Select...</option>',
                ...options.map(opt =>
                    `<option value="${opt.value}">${escapeHtml(opt.label)}</option>`
                )
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
            return `
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="entry-value" value="true">
                        <span>${escapeHtml(config.label)}</span>
                    </label>
                </div>
            `;
        }

        if (config.inputType === 'range') {
            return `
                <div class="form-group">
                    <label for="entry-value">${escapeHtml(config.label)} *</label>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <input type="range" id="entry-value" min="${config.min || 0}" max="${config.max || 100}" step="${config.step || 1}" value="${config.min || 0}" style="flex: 1;" required>
                        <span id="range-value-display" style="min-width: 3rem; text-align: right; font-weight: 500;">${config.min || 0}</span>
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

    private renderPropertyInputs(properties: EntityProperty[]): string {
        return properties.map(prop => {
            const config = getValueTypeInputConfig(prop.valueType);
            const propId = `property-${prop.id}`;
            const requiredAttr = prop.required ? 'required' : '';

            if (config.inputType === 'checkbox') {
                return `
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="${propId}" value="true">
                            <span>${escapeHtml(prop.name)}${prop.required ? ' *' : ''}</span>
                        </label>
                    </div>
                `;
            }

            if (prop.valueType === 'select' && prop.options) {
                return `
                    <div class="form-group">
                        <label for="${propId}">${escapeHtml(prop.name)}${prop.required ? ' *' : ''}</label>
                        <select id="${propId}" ${requiredAttr}>
                            <option value="">Select...</option>
                            ${prop.options.map(opt => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`).join('')}
                        </select>
                    </div>
                `;
            }

            const attrs: string[] = [
                `type="${config.inputType}"`,
                `id="${propId}"`,
                requiredAttr
            ];

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
        const form = this.querySelector('#entry-form') as HTMLFormElement;
        const entitySelect = this.querySelector('#entry-entity') as HTMLSelectElement;
        const uploadBtn = this.querySelector('#upload-image-btn') as HTMLButtonElement;
        const captureBtn = this.querySelector('#capture-image-btn') as HTMLButtonElement;
        const fileInput = this.querySelector('#image-upload') as HTMLInputElement;

        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        if (entitySelect) {
            entitySelect.addEventListener('change', () => {
                const selectedEntityId = entitySelect.value;
                const selectedEntity = selectedEntityId ? this.store.getEntityById(selectedEntityId) : null;
                const valueContainer = this.querySelector('#value-input-container');
                const propertiesContainer = this.querySelector('#properties-input-container');

                if (valueContainer) {
                    if (selectedEntity && selectedEntity.valueType) {
                        valueContainer.innerHTML = this.renderValueInput(selectedEntity.valueType, selectedEntity.options);
                        this.attachRangeListener();
                    } else {
                        valueContainer.innerHTML = '';
                    }
                }

                if (propertiesContainer && selectedEntity) {
                    propertiesContainer.innerHTML = selectedEntity.properties && selectedEntity.properties.length > 0
                        ? this.renderPropertyInputs(selectedEntity.properties)
                        : '';
                }
            });
        }

        // Image upload/capture handlers
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                fileInput?.click();
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleImageUpload(e));
        }

        if (captureBtn) {
            captureBtn.addEventListener('click', () => this.handleCameraCapture());
        }

        // Attach range input listener for initial render
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

    private isUrl(text: string): boolean {
        try {
            const url = new URL(text);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }

    private async fetchAndUpdateTitle(entryId: string, url: string): Promise<void> {
        try {
            const metadata = await fetchUrlMetadata(url);
            // Only update if we got a meaningful title
            if (metadata.title && metadata.title !== url) {
                this.store.updateEntry(entryId, { valueDisplay: metadata.title });
            }
        } catch (error) {
            console.error('Failed to fetch page title:', error);
        }
    }

    private async processTextWithUrls(entryId: string, text: string, field: 'value' | 'notes'): Promise<void> {
        try {
            const urls = extractUrls(text);
            if (urls.length === 0) return;

            const result = await replaceUrlsWithTitles(text);

            // Update the entry with processed text
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

    private async fetchPropertyUrlTitles(entryId: string, properties: EntityProperty[], propertyValues: Record<string, string | number | boolean>): Promise<void> {
        try {
            const propertyValueDisplays: Record<string, string> = {};
            const fetchPromises: Promise<void>[] = [];

            properties.forEach(prop => {
                if (prop.valueType === 'url' && propertyValues[prop.id]) {
                    const url = String(propertyValues[prop.id]);
                    if (this.isUrl(url)) {
                        const promise = fetchUrlMetadata(url).then(metadata => {
                            if (metadata.title && metadata.title !== url) {
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

    private async handleSubmit(e: Event): Promise<void> {
        e.preventDefault();

        try {
            const entityId = (this.querySelector('#entry-entity') as HTMLSelectElement).value;
            const entity = this.store.getEntityById(entityId);

            if (!entity) {
                throw new Error('Please select a valid entity');
            }

            // Get value based on valueType (only if entity has a valueType)
            let value: string | number | boolean | undefined;
            let valueDisplay: string | undefined;
            const valueInput = this.querySelector('#entry-value') as HTMLInputElement | HTMLSelectElement;

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
                        // Check if text contains a URL
                        if (this.isUrl(valueInput.value)) {
                            try {
                                const urlObj = new URL(valueInput.value);
                                valueDisplay = urlObj.hostname.replace('www.', '');
                            } catch {
                                // Not a valid URL, use as-is
                            }
                        }
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
                        // Use URL as initial display value
                        try {
                            const urlObj = new URL(valueInput.value);
                            valueDisplay = urlObj.hostname.replace('www.', '');
                        } catch {
                            // Invalid URL, use as-is
                        }
                        break;
                }
            }

            const formData: EntryFormData = {
                timestamp: getCurrentTimestamp(),
                value: value,
                valueDisplay: valueDisplay,
                notes: (this.querySelector('#entry-notes') as HTMLTextAreaElement).value
            };

            const entry = Entry.fromFormData(formData, entity);

            // Add images if any
            if (this.images.length > 0) {
                entry.images = [...this.images];
            }

            // Collect property values
            if (entity.properties && entity.properties.length > 0) {
                const propertyValues: Record<string, string | number | boolean> = {};
                entity.properties.forEach(prop => {
                    const input = this.querySelector(`#property-${prop.id}`) as HTMLInputElement;
                    if (input) {
                        if (prop.valueType === 'checkbox') {
                            propertyValues[prop.id] = input.checked;
                        } else if (prop.valueType === 'number' || prop.valueType === 'duration' || prop.valueType === 'rating') {
                            propertyValues[prop.id] = parseFloat(input.value) || 0;
                        } else {
                            propertyValues[prop.id] = input.value;
                        }
                    }
                });
                entry.propertyValues = propertyValues;
            }

            this.store.addEntry(entry);

            // Process URLs asynchronously
            const notesValue = (this.querySelector('#entry-notes') as HTMLTextAreaElement).value;

            // For single URL values (hyperlink, image, audio, video)
            if (value && typeof value === 'string' && this.isUrl(value)) {
                this.fetchAndUpdateTitle(entry.id, value);
            }
            // For text values that may contain URLs
            else if (value && typeof value === 'string' && entity.valueType === 'text') {
                this.processTextWithUrls(entry.id, value, 'value');
            }

            // Process URLs in notes field
            if (notesValue && notesValue.trim()) {
                this.processTextWithUrls(entry.id, notesValue, 'notes');
            }

            // Fetch titles for URL-type properties
            if (entity.properties && entity.properties.length > 0 && entry.propertyValues) {
                this.fetchPropertyUrlTitles(entry.id, entity.properties, entry.propertyValues);
            }

            // Close the panel via URL
            URLStateManager.closePanel();

            // Reset form and images
            (e.target as HTMLFormElement).reset();
            this.images = [];
            this.renderImagePreview();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            alert(`Error logging entry: ${message}`);
        }
    }
}
