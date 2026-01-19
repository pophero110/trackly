import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { Entry } from '../models/Entry.js';
import { escapeHtml } from '../utils/helpers.js';
import { URLStateManager } from '../utils/urlState.js';

/**
 * EntryDetailFooter Lit Component
 * Displays hashtags, location info, and file upload action
 */
@customElement('entry-detail-footer')
export class EntryDetailFooter extends LitElement {
  @property({ type: Object })
  entry!: Entry;

  @property({ type: Array })
  hashtags: string[] = [];

  // Disable Shadow DOM for compatibility with existing global styles
  createRenderRoot() {
    return this;
  }

  private handleHashtagClick = (e: Event, tag: string): void => {
    e.preventDefault();
    URLStateManager.setHashtagFilter(tag);
    URLStateManager.showHome();
  };

  private handleFileUpload = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    // Dispatch custom event for parent to handle file upload
    this.dispatchEvent(new CustomEvent('file-upload', {
      detail: { files: Array.from(input.files) },
      bubbles: true,
      composed: true
    }));

    // Reset input so the same file can be selected again
    input.value = '';
  };

  private triggerFileInput = (): void => {
    const fileInput = this.querySelector('#file-upload-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  };

  render() {
    const hasLocation = this.entry.latitude && this.entry.longitude;
    const hasHashtags = this.hashtags.length > 0;

    return html`
      <div class="entry-detail-footer-section">
        <div class="entry-detail-footer-content">
          ${when(hasHashtags, () => html`
            <div class="entry-detail-hashtags">
              ${map(this.hashtags, tag => html`
                <a
                  href="#"
                  class="entry-detail-hashtag"
                  @click=${(e: Event) => this.handleHashtagClick(e, tag)}>
                  #${escapeHtml(tag)}
                </a>
              `)}
            </div>
          `)}

          ${when(hasLocation, () => html`
            <div class="entry-detail-location">
              <i class="ph ph-map-pin"></i>
              <a
                href="https://www.google.com/maps?q=${this.entry.latitude},${this.entry.longitude}"
                target="_blank"
                rel="noopener noreferrer"
                class="location-link">
                ${this.entry.locationName || `${this.entry.latitude!.toFixed(4)}, ${this.entry.longitude!.toFixed(4)}`}
              </a>
            </div>
          `)}
        </div>

        <div class="entry-detail-footer-actions">
          <button
            class="footer-action-btn"
            @click=${this.triggerFileInput}
            title="Upload image">
            <i class="ph ph-paperclip"></i>
          </button>
          <input
            type="file"
            id="file-upload-input"
            accept="image/*"
            multiple
            style="display: none;"
            @change=${this.handleFileUpload}>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entry-detail-footer': EntryDetailFooter;
  }
}
