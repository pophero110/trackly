import { css, html, LitElement } from 'lit';
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
  static styles = css`
    .entry-detail-hashtag {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      background: var(--background);
      border-radius: 12px;
      font-size: 0.75rem;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .entry-detail-hashtag:hover {
      background: var(--primary);
      color: white;
      opacity: 1;
    }
  `
  @property({ type: Object })
  entry!: Entry;

  @property({ type: Array })
  hashtags: string[] = [];

  private handleHashtagClick = (e: Event, tag: string): void => {
    URLStateManager.showHome();
    URLStateManager.addTagFilter(tag);
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
              <span
                class="entry-detail-hashtag"
                @click=${(e: Event) => this.handleHashtagClick(e, tag)}>
                #${tag}
              </span>
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
