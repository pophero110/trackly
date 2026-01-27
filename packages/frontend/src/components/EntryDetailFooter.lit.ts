import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { Entry } from '../models/Entry.js';
import { URLStateManager } from '../utils/urlState.js';

/**
 * EntryDetailFooter Lit Component
 * Displays hashtags and location info
 */
@customElement('entry-detail-footer')
export class EntryDetailFooter extends LitElement {
  @property({ type: Object })
  entry!: Entry;

  @property({ type: Array })
  hashtags: string[] = [];

  private handleHashtagClick = (e: Event, tag: string): void => {
    e.preventDefault();
    URLStateManager.setHashtagFilter(tag);
    URLStateManager.showHome();
  };

  render() {
    const hasLocation = this.entry.latitude && this.entry.longitude;
    const hasHashtags = this.hashtags.length > 0;

    if (!hasLocation && !hasHashtags) {
      return html``;
    }

    return html`
      <div class="entry-detail-footer-section">
        ${when(hasHashtags, () => html`
          <div class="entry-detail-hashtags">
            ${map(this.hashtags, tag => html`
              <a
                href="#"
                class="entry-detail-hashtag"
                @click=${(e: Event) => this.handleHashtagClick(e, tag)}>
                #${tag}
              </a>
            `)}
          </div>
        `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entry-detail-footer': EntryDetailFooter;
  }
}
