import { WebComponent } from './WebComponent.js';
import { Entry } from '../models/Entry.js';
import { ValueType, EntityProperty } from '../types/index.js';
import { escapeHtml, extractUrls, replaceUrlsWithTitles, fetchUrlMetadata } from '../utils/helpers.js';
import { URLStateManager } from '../utils/urlState.js';
import { getValueTypeInputConfig } from '../config/valueTypeConfig.js';
import { ensureH1Heading } from '../utils/markdown.js';

/**
 * EntryEditForm Web Component for editing existing entries
 */
export class EntryEditFormComponent extends WebComponent {
  private entryId: string | null = null;
  private entry: Entry | null = null;
  private images: string[] = [];
  private links: string[] = [];
  private linkTitles: Record<string, string> = {};
  private entryReferences: string[] = []; // Entry IDs that this entry references
  private location: { latitude: number; longitude: number; name?: string } | null = null;
  private hasUnsavedChanges: boolean = false;
  private linkInputMode: 'url' | 'entry' = 'url'; // Track which tab is active

  connectedCallback(): void {
    // Don't auto-render, wait for setEntry()
  }

  setEntry(entryId: string): void {
    this.entryId = entryId;

    // Show loading state if data hasn't loaded yet
    if (!this.store.getIsLoaded()) {
      this.innerHTML = this.renderLoadingState('Loading entry...');
      // Subscribe to store to render when data loads
      this.unsubscribe = this.store.subscribe(() => {
        if (this.store.getIsLoaded()) {
          this.initializeEntry(entryId);
          // Unsubscribe after initialization to prevent repeated calls
          if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
          }
        }
      });
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
      this.entryReferences = foundEntry.entryReferences ? [...foundEntry.entryReferences] : [];
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

                <div class="form-group">
                    <label for="entry-timestamp">Time</label>
                    <input type="datetime-local" id="entry-timestamp" value="${this.formatTimestampForInput(this.entry.timestamp)}">
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Update Entry</button>
                </div>
            </form>
        `;
  }

  private renderValueInput(valueType: ValueType, currentValue?: string | number | boolean, entityOptions?: Array<{ value: string; label: string }>): string {
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

    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));

      // Add Cmd+Enter keyboard shortcut to submit
      form.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          form.requestSubmit();
        }
      });
    }
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
      // Check for plain domain format with valid TLD (e.g., example.com, github.io)
      const validTLDs = /\.(com|org|net|edu|gov|io|co|uk|us|de|fr|jp|cn|au|in|br|ca|ru|nl|se|no|fi|dk|pl|it|es|be|ch|at|nz|sg|hk|kr|tw|my|th|id|ph|vn|za|ae|sa|eg|ng|ke)$/i;
      return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/.test(text) && validTLDs.test(text);
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
            // Normalize URLs to include https://
            let normalizedUrl = url;
            if (url.startsWith('www.')) {
              normalizedUrl = 'https://' + url;
            } else if (!/^https?:\/\//.test(url)) {
              // Plain domain like "example.com"
              normalizedUrl = 'https://' + url;
            }

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

      // Get timestamp and convert to ISO format
      const timestampInput = (this.querySelector('#entry-timestamp') as HTMLInputElement).value;
      const timestamp = timestampInput ? new Date(timestampInput).toISOString() : this.entry.timestamp;

      // Update the entry (include entityId and entityName if changed)
      const updates: any = {
        timestamp: timestamp
      };

      // Add entityId and entityName if entity was changed
      if (selectedEntityId !== this.entry.entityId) {
        updates.entityId = selectedEntityId;
        updates.entityName = entity.name;
      }

      // Update entry
      await this.store.updateEntry(this.entryId, updates);

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
    const entrySearchInput = this.querySelector('#entry-search-input') as HTMLInputElement;

    if (linkInputContainer) {
      linkInputContainer.style.display = 'flex';

      // Focus on the correct input based on current mode
      if (this.linkInputMode === 'url' && linkInput) {
        linkInput.value = '';
        linkInput.focus();
      } else if (this.linkInputMode === 'entry' && entrySearchInput) {
        entrySearchInput.value = '';
        entrySearchInput.focus();
        this.handleEntrySearch(''); // Show all entries initially
      }
    }
  }

  private hideLinkInput(): void {
    const linkInputContainer = this.querySelector('#link-input-container') as HTMLElement;
    const linkInput = this.querySelector('#link-input') as HTMLInputElement;
    const entrySearchInput = this.querySelector('#entry-search-input') as HTMLInputElement;
    const searchResults = this.querySelector('#entry-search-results') as HTMLElement;

    if (linkInputContainer) {
      linkInputContainer.style.display = 'none';
      if (linkInput) linkInput.value = '';
      if (entrySearchInput) entrySearchInput.value = '';
      if (searchResults) searchResults.style.display = 'none';
    }
  }

  private switchLinkTab(mode: 'url' | 'entry'): void {
    this.linkInputMode = mode;

    const linkInput = this.querySelector('#link-input') as HTMLInputElement;
    const entrySearchInput = this.querySelector('#entry-search-input') as HTMLInputElement;
    const addButton = this.querySelector('#add-link-btn-action') as HTMLButtonElement;
    const tabs = this.querySelectorAll('.link-tab');
    const searchResults = this.querySelector('#entry-search-results') as HTMLElement;

    // Update tab active state
    tabs.forEach(tab => {
      const tabElement = tab as HTMLElement;
      if (tabElement.dataset.tab === mode) {
        tabElement.classList.add('link-tab-active');
      } else {
        tabElement.classList.remove('link-tab-active');
      }
    });

    // Show/hide inputs based on mode
    if (mode === 'url') {
      if (linkInput) {
        linkInput.style.display = 'block';
        linkInput.focus();
      }
      if (entrySearchInput) entrySearchInput.style.display = 'none';
      if (searchResults) searchResults.style.display = 'none';
      if (addButton) addButton.style.display = 'block';
    } else {
      if (linkInput) linkInput.style.display = 'none';
      if (entrySearchInput) {
        entrySearchInput.style.display = 'block';
        entrySearchInput.focus();
        this.handleEntrySearch(''); // Show all entries
      }
      if (addButton) addButton.style.display = 'none'; // Hide add button for entry mode
    }
  }

  private handleEntrySearch(query: string): void {
    const searchResults = this.querySelector('#entry-search-results') as HTMLElement;
    if (!searchResults) return;

    const entries = this.store.getEntries();
    const lowerQuery = query.toLowerCase();

    // Filter entries based on search query (exclude current entry)
    const filteredEntries = entries.filter(entry => {
      // Exclude the current entry being edited
      if (entry.id === this.entry.id) return false;

      if (query === '') return true; // Show all if no query

      const entityName = entry.entityName.toLowerCase();
      const notes = (entry.notes || '').toLowerCase();
      const value = (entry.valueDisplay || entry.value || '').toString().toLowerCase();

      return entityName.includes(lowerQuery) ||
        notes.includes(lowerQuery) ||
        value.includes(lowerQuery);
    });

    // Sort by timestamp (most recent first)
    filteredEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Limit to 50 results for performance
    const limitedEntries = filteredEntries.slice(0, 50);

    // Render results
    if (limitedEntries.length === 0) {
      searchResults.innerHTML = '<div class="entry-search-no-results">No entries found</div>';
    } else {
      searchResults.innerHTML = limitedEntries.map(entry => {
        const timestamp = new Date(entry.timestamp);
        const formattedTime = timestamp.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const displayValue = entry.valueDisplay || entry.value;
        const notes = entry.notes || '';
        const preview = notes ? notes.substring(0, 100) : (displayValue ? `Value: ${displayValue}` : '');

        return `
                    <div class="entry-search-result-item" data-entry-id="${entry.id}">
                        <div class="entry-search-result-entity">${escapeHtml(entry.entityName)}</div>
                        <div class="entry-search-result-time">${formattedTime}</div>
                        ${preview ? `<div class="entry-search-result-notes">${escapeHtml(preview)}</div>` : ''}
                    </div>
                `;
      }).join('');

      // Add click handlers to result items
      const resultItems = searchResults.querySelectorAll('.entry-search-result-item');
      resultItems.forEach(item => {
        item.addEventListener('click', () => {
          const entryId = (item as HTMLElement).dataset.entryId;
          if (entryId) {
            this.addEntryReference(entryId);
          }
        });
      });
    }

    // Position the dropdown using fixed positioning
    const entrySearchInput = this.querySelector('#entry-search-input') as HTMLInputElement;
    if (entrySearchInput) {
      const rect = entrySearchInput.getBoundingClientRect();
      const dropdownMaxHeight = 250;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Calculate available space below and above
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top = rect.bottom + 4;
      let maxHeight = Math.min(dropdownMaxHeight, spaceBelow - 20);

      // If not enough space below, show above
      if (spaceBelow < 150 && spaceAbove > spaceBelow) {
        top = rect.top - Math.min(dropdownMaxHeight, spaceAbove - 20);
        maxHeight = Math.min(dropdownMaxHeight, spaceAbove - 20);
      }

      // Ensure left position stays within viewport
      let left = rect.left;
      const dropdownWidth = Math.min(rect.width, viewportWidth - 40);
      if (left + dropdownWidth > viewportWidth - 20) {
        left = viewportWidth - dropdownWidth - 20;
      }
      if (left < 20) {
        left = 20;
      }

      searchResults.style.left = `${left}px`;
      searchResults.style.top = `${top}px`;
      searchResults.style.width = `${dropdownWidth}px`;
      searchResults.style.maxHeight = `${maxHeight}px`;
    }

    searchResults.style.display = 'block';
  }

  private addEntryReference(entryId: string): void {
    // Check if already referenced
    if (this.entryReferences.includes(entryId)) {
      return;
    }

    this.entryReferences.push(entryId);
    this.hasUnsavedChanges = true;
    this.render();
    this.attachEventListeners();
    this.hideLinkInput();
  }

  private removeEntryReference(entryId: string): void {
    const index = this.entryReferences.indexOf(entryId);
    if (index > -1) {
      this.entryReferences.splice(index, 1);
      this.hasUnsavedChanges = true;
      this.render();
      this.attachEventListeners();
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

    // Normalize URL to include protocol
    let normalizedUrl = trimmedUrl;
    if (trimmedUrl.startsWith('www.')) {
      normalizedUrl = 'https://' + trimmedUrl;
    } else if (!/^https?:\/\//.test(trimmedUrl)) {
      // Plain domain without www or protocol
      normalizedUrl = 'https://' + trimmedUrl;
    }

    // Add the normalized URL to entry's links array
    if (!this.entry.links) {
      this.entry.links = [];
    }
    this.entry.links.push(normalizedUrl);

    // Mark as having unsaved changes
    this.hasUnsavedChanges = true;

    // Re-render to show the new link (initially shows URL)
    this.render();
    this.attachEventListeners();

    // Hide the link input
    this.hideLinkInput();

    // Fetch title asynchronously with normalized URL
    try {
      const metadata = await fetchUrlMetadata(normalizedUrl);
      if (metadata.title && metadata.title !== normalizedUrl) {
        this.linkTitles[normalizedUrl] = metadata.title;
        // Re-render to show the title
        this.render();
        this.attachEventListeners();
      }
    } catch (error) {
      console.error(`Failed to fetch title for link ${normalizedUrl}:`, error);
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
    const hasLinks = this.entry.links && this.entry.links.length > 0;
    const hasEntryReferences = this.entryReferences && this.entryReferences.length > 0;

    if (!hasLinks && !hasEntryReferences) {
      return '';
    }

    // Render external links
    const linksHtml = hasLinks ? this.entry.links.map((link, index) => {
      // Use title if available, otherwise show URL
      const displayText = this.linkTitles[link] || link;
      return `
            <div class="link-item">
                <a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" class="link-url" title="${escapeHtml(link)}">${escapeHtml(displayText)}</a>
                <button type="button" class="btn-remove-link" data-index="${index}">×</button>
            </div>
        `}).join('') : '';

    // Render entry references
    const entryReferencesHtml = hasEntryReferences ? this.entryReferences.map((entryId) => {
      const refEntry = this.store.getEntryById(entryId);
      if (!refEntry) return '';
      // Get first line of notes as title, or use entity name
      const title = refEntry.notes ? refEntry.notes.split('\n')[0].replace(/^#\s*/, '').trim() : refEntry.entityName;
      return `
            <div class="link-item entry-reference-item">
                <a href="/entries/${escapeHtml(entryId)}" class="link-url entry-reference-link">${escapeHtml(title)}</a>
                <button type="button" class="btn-remove-entry-ref" data-entry-id="${escapeHtml(entryId)}">×</button>
            </div>
        `}).filter(html => html).join('') : '';

    return `<div class="links-display"><div class="links-container">${linksHtml}${entryReferencesHtml}</div></div>`;
  }
}
