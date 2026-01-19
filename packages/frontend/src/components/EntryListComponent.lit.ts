import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { StoreController } from '../controllers/StoreController.js';
import { EntryListController } from '../controllers/EntryListController.js';
import './EntryListHeader.lit.js';
import './EntryListItem.lit.js';

/**
 * EntryList Lit Component for displaying entries in a timeline view
 * Uses Reactive Controllers for separation of concerns:
 * - StoreController: Manages store connection and updates
 * - EntryListController: Handles filtering, grouping, and business logic
 */
@customElement('entry-list')
export class EntryListComponent extends LitElement {
  // Controllers handle all logic
  private storeController = new StoreController(this);
  private listController = new EntryListController(this, this.storeController);

  // Disable Shadow DOM for compatibility with existing global styles
  createRenderRoot() {
    return this;
  }

  render() {
    // Check if store is available and loaded
    if (!this.storeController.store || !this.storeController.isLoaded) {
      return html`
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading entries...</p>
          </div>
      `;
    }

    // Get all data from controllers
    const entries = this.listController.getFilteredEntries();
    const selectedEntity = this.listController.getSelectedEntity();
    const tagFilters = this.listController.getTagFilters();
    const hashtagFilter = this.listController.getHashtagFilter();
    const { sortValue } = this.listController.getSortConfig();
    const allEntries = this.listController.getAllEntries();

    // Empty state
    if (entries.length === 0) {
      const msg = selectedEntity ? `No entries yet for ${selectedEntity.name}.` : 'No entries yet.';
      return html`
          <entry-list-header
            .selectedEntity=${selectedEntity}
            .tagFilters=${tagFilters}
            .hashtagFilter=${hashtagFilter}
            .currentSortValue=${sortValue}
            .allEntries=${allEntries}>
          </entry-list-header>
          <div class="empty-state">${msg}</div>
      `;
    }

    // Group entries by date using controller
    const entriesByDate = this.listController.groupEntriesByDate(entries);

    return html`
        <entry-list-header
          .selectedEntity=${selectedEntity}
          .tagFilters=${tagFilters}
          .hashtagFilter=${hashtagFilter}
          .currentSortValue=${sortValue}
          .allEntries=${allEntries}>
        </entry-list-header>
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
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entry-list': EntryListComponent;
  }
}
