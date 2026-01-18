import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LitBaseComponent } from './LitBaseComponent.js';
import { Entry } from '../models/Entry.js';
import { extractHashtags } from '../utils/helpers.js';
import { URLStateManager } from '../utils/urlState.js';
import { storeRegistry } from '../state/StoreRegistry.js';
import './EntryListHeader.lit.js';
import './EntryListItem.lit.js';

/**
 * EntryList Lit Component for displaying entries in a timeline view
 * Lit version of the original EntryListComponent
 */
@customElement('entry-list')
export class EntryListComponent extends LitBaseComponent {
  @state()
  private maxEntries: number = 30;

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  private groupEntriesByDate(entries: Entry[]): Map<string, Entry[]> {
    const groups = new Map<string, Entry[]>();

    entries.forEach(entry => {
      const date = new Date(entry.timestamp);
      const dateKey = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(entry);
    });

    return groups;
  }

  render() {
    // Try to get store if not available yet
    if (!this.store) {
      try {
        this.store = storeRegistry.getStore();
        // Subscribe to store changes
        if (!this.unsubscribe) {
          this.unsubscribe = this.store.subscribe(() => this.requestUpdate());
        }
      } catch (e) {
        // Store not ready yet
        return html`
          <div class="section">
            ${this.renderLoadingState('Loading entries...')}
          </div>
        `;
      }
    }

    // Handle case where store is not loaded yet
    if (!this.store.getIsLoaded()) {
      return html`
        <div class="section">
          ${this.renderLoadingState('Loading entries...')}
        </div>
      `;
    }

    // Get data from store
    const selectedEntityId = this.store.getSelectedEntityId();
    let entries = this.store.getEntries();

    // Filter by selected entity
    if (selectedEntityId) {
      entries = entries.filter(e => e.entityId === selectedEntityId);
    }

    // Filter by tags
    const tagFilters = URLStateManager.getTagFilters();
    if (tagFilters.length > 0) {
      entries = entries.filter(e => {
        if (!e.notes) return false;
        const entryTags = extractHashtags(e.notes);
        return tagFilters.every(tag => entryTags.some(et => et.toLowerCase() === tag.toLowerCase()));
      });
    }

    // Get header data
    const selectedEntity = selectedEntityId ? this.store.getEntityById(selectedEntityId) : null;
    const hashtagFilter = URLStateManager.getHashtagFilter();
    const currentSortBy = URLStateManager.getSortBy() || 'timestamp';
    const currentSortOrder = URLStateManager.getSortOrder() || 'desc';
    const currentSortValue = `${currentSortBy}-${currentSortOrder}`;
    const allEntries = this.store.getEntries();

    // Empty state
    if (entries.length === 0) {
      const msg = selectedEntity ? `No entries yet for ${selectedEntity.name}.` : 'No entries yet.';
      return html`
        <div class="section">
          <entry-list-header
            .selectedEntity=${selectedEntity}
            .tagFilters=${tagFilters}
            .hashtagFilter=${hashtagFilter}
            .currentSortValue=${currentSortValue}
            .allEntries=${allEntries}>
          </entry-list-header>
          <div class="empty-state">${msg}</div>
        </div>
      `;
    }

    // Group entries by date
    const entriesByDate = this.groupEntriesByDate(entries.slice(0, this.maxEntries));

    return html`
      <div class="section">
        <entry-list-header
          .selectedEntity=${selectedEntity}
          .tagFilters=${tagFilters}
          .hashtagFilter=${hashtagFilter}
          .currentSortValue=${currentSortValue}
          .allEntries=${allEntries}>
        </entry-list-header>

        <div class="entries-grid">
          ${repeat(
      Array.from(entriesByDate.entries()),
      ([dateKey]) => dateKey,
      ([dateKey, dateEntries]) => html`
              <div class="timeline-date-group">
                <div class="timeline-date-header">${dateKey}</div>
                <div class="timeline-entries">
                  ${repeat(
        dateEntries,
        (entry) => entry.id,
        (entry) => html`
                      <entry-list-item .entry=${entry}></entry-list-item>
                    `
      )}
                </div>
              </div>
            `
    )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entry-list': EntryListComponent;
  }
}
