import { html, LitElement } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { Entry } from '../models/Entry.js';
import { Entity } from '../models/Entity.js';
import { EntityProperty } from '../types/index.js';
import { escapeHtml, extractHashtags } from '../utils/helpers.js';
import { parseMarkdown } from '../utils/markdown.js';
import { URLStateManager } from '../utils/urlState.js';
import { getEntityColor } from '../utils/entryHelpers.js';
import { Store } from '../state/Store.js';
import { storeRegistry } from '../state/StoreRegistry.js';
import { toast } from '../utils/toast.js';
import './DropdownMenuComponent.lit.js';
import type { DropdownMenuComponent, DropdownMenuItem } from './DropdownMenuComponent.lit.js';

type OpenDropdown = 'context-menu' | 'entity-menu' | null;

/**
 * EntryListItem Lit Component
 * Displays a single entry card with all its details
 */
@customElement('entry-list-item')
export class EntryListItem extends LitElement {
  @property({ type: Object })
  entry!: Entry;

  @state()
  private openDropdown: OpenDropdown = null;

  @query('dropdown-menu[data-menu-type="context"]')
  private contextMenu?: DropdownMenuComponent;

  @query('dropdown-menu[data-menu-type="entity"]')
  private entityMenu?: DropdownMenuComponent;

  private store!: Store;

  private get contextMenuItems(): DropdownMenuItem[] {
    return [
      {
        id: 'archive',
        label: 'Archive',
        icon: 'ph-duotone ph-archive'
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: 'ph-duotone ph-trash',
        danger: true
      }
    ];
  }

  private get entityMenuItems(): DropdownMenuItem[] {
    const allEntities = this.store?.getEntities() || [];
    return allEntities.map(entity => ({
      id: entity.id,
      label: entity.name,
      color: getEntityColor(entity.name),
      data: entity
    }));
  }

  connectedCallback(): void {
    super.connectedCallback();
    try {
      this.store = storeRegistry.getStore();
    } catch (e) {
      console.warn('EntryListItem: Store not yet initialized');
    }
  }

  // Disable Shadow DOM for compatibility with existing global styles
  createRenderRoot() {
    return this;
  }

  private handleCardClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-action="menu"], a, .entry-chip-tag, .entry-chip-entity-container')) {
      return;
    }
    URLStateManager.showEntryDetail(this.entry.id);
  };

  private handleMenuButtonClick = (e: MouseEvent) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const menuButton = target.closest('[data-action="menu"]') as HTMLElement;

    if (!this.contextMenu || !menuButton) return;

    // Close entity menu if open
    if (this.openDropdown === 'entity-menu') {
      this.entityMenu?.close();
    }

    this.openDropdown = 'context-menu';
    const rect = menuButton.getBoundingClientRect();
    this.contextMenu.openAt(rect.right, rect.bottom + 4);
  };

  private handleContextMenuAction = (e: CustomEvent) => {
    const { action } = e.detail;

    if (action === 'archive') {
      this.handleArchive();
    } else if (action === 'delete') {
      this.handleDelete();
    }
  };

  private handleTagClick = (e: MouseEvent, tag: string) => {
    e.stopPropagation();
    URLStateManager.addTagFilter(tag);
  };

  private handleEntityChipClick = (e: MouseEvent) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const entityChip = target.closest('.entry-chip-entity-container') as HTMLElement;

    if (!this.entityMenu || !entityChip) return;

    // Close context menu if open
    if (this.openDropdown === 'context-menu') {
      this.contextMenu?.close();
    }

    this.openDropdown = 'entity-menu';
    const rect = entityChip.getBoundingClientRect();
    this.entityMenu.openAt(rect.left, rect.bottom + 4);
  };

  private handleEntityMenuAction = (e: CustomEvent) => {
    const { data } = e.detail;
    if (data) {
      this.handleEntityChange(data as Entity);
    }
  };

  private handleContextMenuClose = () => {
    if (this.openDropdown === 'context-menu') {
      this.openDropdown = null;
    }
  };

  private handleEntityMenuClose = () => {
    if (this.openDropdown === 'entity-menu') {
      this.openDropdown = null;
    }
  };

  private async handleEntityChange(newEntity: Entity) {
    if (!this.store) {
      console.error('Store not available');
      return;
    }

    const oldEntityId = this.entry.entityId;
    const oldEntityName = this.entry.entityName;

    // Optimistic update
    this.entry = {
      ...this.entry,
      entityId: newEntity.id,
      entityName: newEntity.name
    };
    this.requestUpdate();

    try {
      await this.store.updateEntry(this.entry.id, {
        entityId: newEntity.id,
        entityName: newEntity.name
      });
    } catch (error) {
      console.error('Error updating entry entity:', error);
      // Rollback on error
      this.entry = {
        ...this.entry,
        entityId: oldEntityId,
        entityName: oldEntityName
      };
      this.requestUpdate();
    }
  };

  private handleDelete(): void {
    if (!this.store) {
      console.error('Store not available');
      return;
    }

    const entry = this.entry;
    const store = this.store;

    toast.show({
      message: 'Entry deleted',
      type: 'success',
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: async () => {
          try {
            await store.addEntry(entry);
            toast.success('Entry restored');
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            toast.error(`Failed to restore entry: ${message}`);
          }
        }
      }
    });

    store.deleteEntry(this.entry.id).catch((error) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error deleting entry: ${message}`);
    });
  }

  private async handleArchive(): Promise<void> {
    if (!this.store) {
      console.error('Store not available');
      return;
    }

    // Show success toast immediately (optimistic update)
    toast.success('Entry archived successfully');

    try {
      await this.store.archiveEntry(this.entry.id, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error archiving entry: ${message}`);
    }
  }


  private getEntityTypeIcon(type?: string): string {
    if (!type) return '●';

    const icons: Record<string, string> = {
      'Habit': '🎯',
      'Task': '✓',
      'Event': '📅',
      'Note': '📝',
      'Expense': '💰',
      'Mood': '😊',
      'Exercise': '💪',
      'Meal': '🍽️',
      'Sleep': '😴',
      'Reading': '📚',
      'Movie': '🎬',
      'Goal': '🎯',
      'Journal': '📔',
      'Idea': '💡',
      'Link': '🔗'
    };

    return icons[type] || '●';
  }

  private formatValue(value: string | number | boolean, displayValue?: string, valueType?: string): string {
    const valueStr = String(value);

    // Check if it's a URL
    if (valueStr.startsWith('http://') || valueStr.startsWith('https://')) {
      // Image
      if (valueStr.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) {
        return `<img src="${escapeHtml(valueStr)}" alt="Entry image" style="max-width: 100%; border-radius: 4px; margin-top: 4px;">`;
      }
      // Audio
      if (valueStr.match(/\.(mp3|wav|ogg|m4a)(\?|$)/i)) {
        return `<audio controls style="width: 100%; margin-top: 4px;"><source src="${escapeHtml(valueStr)}"></audio>`;
      }
      // Video
      if (valueStr.match(/\.(mp4|webm|ogv)(\?|$)/i)) {
        return `<video controls style="max-width: 100%; border-radius: 4px; margin-top: 4px;"><source src="${escapeHtml(valueStr)}"></video>`;
      }
      // Hyperlink
      const linkText = displayValue || valueStr;
      return `<a href="${escapeHtml(valueStr)}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">${escapeHtml(linkText)}</a>`;
    }

    // Check if value contains [[title::url]] format
    if (valueStr.includes('[[') && valueStr.includes('::')) {
      return parseMarkdown(valueStr);
    }

    // Status badges
    const statusValues = ['todo', 'in-progress', 'done', 'yes', 'no', 'pending', 'not-started', 'completed', 'draft', 'active', 'on-hold'];
    if (statusValues.includes(valueStr)) {
      const displayMap: Record<string, string> = {
        'in-progress': 'In Progress',
        'todo': 'To Do',
        'done': 'Done',
        'yes': 'Yes',
        'no': 'No',
        'pending': 'Pending',
        'not-started': 'Not Started',
        'completed': 'Completed',
        'draft': 'Draft',
        'active': 'Active',
        'on-hold': 'On Hold'
      };
      const displayText = displayMap[valueStr] || valueStr;
      return `<span class="status-badge ${valueStr}">${displayText}</span>`;
    }

    // Boolean/checkbox
    if (valueStr === 'true' || valueStr === 'false') {
      return valueStr === 'true' ? '✓ Yes' : '✗ No';
    }

    // Color value
    if (valueStr.match(/^#[0-9A-Fa-f]{6}$/)) {
      return `<div style="display: inline-flex; align-items: center; gap: 8px;"><div style="width: 24px; height: 24px; background: ${valueStr}; border: 1px solid #ccc; border-radius: 4px;"></div><span>${valueStr}</span></div>`;
    }

    // Date/time value
    if (valueStr.match(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/)) {
      try {
        const date = new Date(valueStr);
        if (!isNaN(date.getTime())) {
          return date.toLocaleString();
        }
      } catch {
        // Not a valid date
      }
    }

    // Add units for numeric value types
    if (valueType) {
      const numValue = Number(valueStr);
      if (!isNaN(numValue)) {
        if (valueType === 'duration') {
          return `${valueStr} minutes`;
        } else if (valueType === 'rating') {
          return `${valueStr}/5`;
        }
      }
    }

    return escapeHtml(valueStr);
  }

  private formatPropertyValue(value: string | number | boolean, valueType: string, displayValue?: string): string {
    const valueStr = String(value);

    if (valueType === 'checkbox') {
      return value === true || value === 'true' ? '✓' : '✗';
    }

    if (valueType === 'url') {
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

    return escapeHtml(valueStr);
  }

  private renderPropertyValues(properties: EntityProperty[], propertyValues: Record<string, string | number | boolean>, propertyValueDisplays?: Record<string, string>) {
    const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

    const propertyItems = properties
      .filter(prop => propertyValues[prop.id] !== undefined && propertyValues[prop.id] !== '')
      .map(prop => {
        const value = propertyValues[prop.id];
        const displayValue = propertyValueDisplays?.[prop.id];
        const formattedValue = this.formatPropertyValue(value, prop.valueType, displayValue);

        // For URL properties, show just the link without the property name
        if (prop.valueType === 'url') {
          return html`<span class="property-tag" .innerHTML=${formattedValue}></span>`;
        }
        return html`<span class="property-tag">${escapeHtml(capitalizeFirstLetter(prop.name))}: <span .innerHTML=${formattedValue}></span></span>`;
      });

    if (propertyItems.length === 0) return html``;

    return html`
      <div class="entry-properties">
        ${propertyItems.map((item, index) => html`
          ${item}
          ${index < propertyItems.length - 1 ? html`<span class="property-separator">•</span>` : ''}
        `)}
      </div>
    `;
  }

  render() {
    const entity = this.store?.getEntityById(this.entry.entityId);
    const typeIcon = this.getEntityTypeIcon(entity?.type);

    // Entry value
    const entryValue = this.entry.value !== undefined
      ? this.formatValue(this.entry.value, this.entry.valueDisplay, entity?.valueType)
      : '';

    // Entity chip with dropdown
    const entityColor = entity ? getEntityColor(entity.name) : '';
    const allEntities = this.store?.getEntities() || [];

    // Extract hashtags
    const hashtags = this.entry.notes ? extractHashtags(this.entry.notes) : [];

    // Notes
    const notesHtml = this.entry.notes ? parseMarkdown(this.entry.notes) : '';

    return html`
      <div class="timeline-entry" data-entry-id="${this.entry.id}">
        <div class="timeline-entry-card" @click=${this.handleCardClick}>
          <div class="timeline-entry-header">
            <div class="timeline-entry-primary">
              ${when(typeIcon && entryValue, () => html`
                <span class="timeline-entry-icon">${typeIcon}</span>
              `)}
              ${when(entryValue, () => html`
                <div class="timeline-entry-value" .innerHTML=${entryValue}></div>
              `)}
              ${when(entity, () => html`
                <div class="entry-chip-entity-container" style="position: relative;" data-entry-id="${this.entry.id}">
                  <span
                    class="entry-chip entry-chip-entity"
                    data-entity-id="${entity!.id}"
                    data-entity-name="${escapeHtml(entity!.name)}"
                    style="--entity-color: ${entityColor}; cursor: pointer;"
                    @click=${this.handleEntityChipClick}>
                    ${escapeHtml(entity!.name)}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 4px; vertical-align: middle;">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </span>
                </div>
              `)}
            </div>
            <button
              class="entry-menu-btn"
              data-entry-id="${this.entry.id}"
              data-action="menu"
              @click=${this.handleMenuButtonClick}>
              ⋮
            </button>
          </div>

          ${when(
      entity && entity.properties && entity.properties.length > 0 && this.entry.propertyValues,
      () => html`
              <div class="timeline-entry-properties">
                ${this.renderPropertyValues(entity!.properties!, this.entry.propertyValues!, this.entry.propertyValueDisplays)}
              </div>
            `
    )}

          ${when(notesHtml, () => html`
            <div class="timeline-entry-notes" .innerHTML=${notesHtml}></div>
          `)}

          ${when(hashtags.length > 0, () => html`
            <div class="timeline-entry-tags">
              ${map(hashtags, tag => html`
                <span
                  class="entry-chip entry-chip-tag"
                  data-tag="${escapeHtml(tag)}"
                  @click=${(e: MouseEvent) => this.handleTagClick(e, tag)}>
                  #${escapeHtml(tag)}
                </span>
              `)}
            </div>
          `)}
        </div>
      </div>

      <!-- Context Menu -->
      <dropdown-menu
        data-menu-type="context"
        .items=${this.contextMenuItems}
        .menuId=${'entry-menu-' + this.entry.id}
        @menu-action=${this.handleContextMenuAction}
        @menu-close=${this.handleContextMenuClose}>
      </dropdown-menu>

      <!-- Entity Selector Menu -->
      <dropdown-menu
        data-menu-type="entity"
        .items=${this.entityMenuItems}
        .menuId=${'entity-selector-' + this.entry.id}
        @menu-action=${this.handleEntityMenuAction}
        @menu-close=${this.handleEntityMenuClose}>
      </dropdown-menu>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entry-list-item': EntryListItem;
  }
}
