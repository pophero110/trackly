import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { Entry } from '../models/Entry.js';
import { Entity } from '../models/Entity.js';
import { escapeHtml } from '../utils/helpers.js';

/**
 * EntryDetailProperties Lit Component
 * Displays entry value and custom properties
 */
@customElement('entry-detail-properties')
export class EntryDetailProperties extends LitElement {
  @property({ type: Object })
  entry!: Entry;

  @property({ type: Object })
  entity!: Entity;

  // Disable Shadow DOM for compatibility with existing global styles
  createRenderRoot() {
    return this;
  }

  private formatPropertyValue(value: string | number | boolean, valueType?: string, displayValue?: string): string {
    const valueStr = String(value);

    // Checkbox
    if (valueType === 'checkbox') {
      return value === true || value === 'true' ? '✓ Yes' : '✗ No';
    }

    // URL
    if (valueType === 'url') {
      const linkText = displayValue || valueStr;
      return `<a href="${escapeHtml(valueStr)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`;
    }

    // Duration
    if (valueType === 'duration') {
      return `${valueStr} minutes`;
    }

    // Rating
    if (valueType === 'rating') {
      return `${valueStr}/5`;
    }

    // Date/Time
    if (valueType === 'date' || valueType === 'time') {
      return escapeHtml(valueStr);
    }

    // Default
    return escapeHtml(valueStr);
  }

  private formatValue(value: string | number | boolean, displayValue?: string, valueType?: string): string {
    const valueStr = String(value);

    // Check if it's a URL
    if (valueStr.startsWith('http://') || valueStr.startsWith('https://')) {
      // Image
      if (valueStr.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) {
        return `<img src="${escapeHtml(valueStr)}" alt="Entry image" class="entry-detail-image" style="max-width: 100%; border-radius: 4px; margin-top: 8px;">`;
      }
      // Audio
      if (valueStr.match(/\.(mp3|wav|ogg|m4a)(\?|$)/i)) {
        return `<audio controls style="width: 100%; margin-top: 8px;"><source src="${escapeHtml(valueStr)}"></audio>`;
      }
      // Video
      if (valueStr.match(/\.(mp4|webm|ogv)(\?|$)/i)) {
        return `<video controls style="max-width: 100%; border-radius: 4px; margin-top: 8px;"><source src="${escapeHtml(valueStr)}"></video>`;
      }
      // Hyperlink
      const linkText = displayValue || valueStr;
      return `<a href="${escapeHtml(valueStr)}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">${escapeHtml(linkText)}</a>`;
    }

    // Status badges
    const statusValues = ['todo', 'in-progress', 'done', 'yes', 'no', 'pending', 'not-started', 'completed', 'draft', 'active', 'on-hold'];
    if (statusValues.includes(valueStr.toLowerCase())) {
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
      const displayText = displayMap[valueStr.toLowerCase()] || valueStr;
      return `<span class="status-badge ${valueStr.toLowerCase()}">${displayText}</span>`;
    }

    // Boolean/checkbox
    if (valueStr === 'true' || valueStr === 'false') {
      return valueStr === 'true' ? '✓ Yes' : '✗ No';
    }

    // Color value
    if (valueStr.match(/^#[0-9A-Fa-f]{6}$/)) {
      return `<div style="display: inline-flex; align-items: center; gap: 8px;"><div style="width: 24px; height: 24px; background: ${valueStr}; border: 1px solid #ccc; border-radius: 4px;"></div><span>${valueStr}</span></div>`;
    }

    return escapeHtml(valueStr);
  }

  render() {
    const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

    // Entry value
    const hasValue = this.entry.value !== undefined && this.entry.value !== '';
    const formattedValue = hasValue
      ? this.formatValue(this.entry.value!, this.entry.valueDisplay, this.entity.valueType)
      : '';

    // Custom properties
    const hasProperties = this.entity.properties && this.entity.properties.length > 0 && this.entry.propertyValues;
    const propertyItems = hasProperties
      ? this.entity.properties!
          .filter(prop => this.entry.propertyValues![prop.id] !== undefined && this.entry.propertyValues![prop.id] !== '')
          .map(prop => {
            const value = this.entry.propertyValues![prop.id];
            const displayValue = this.entry.propertyValueDisplays?.[prop.id];
            const formattedPropValue = this.formatPropertyValue(value, prop.valueType, displayValue);

            // For URL properties, show just the link without the property name
            if (prop.valueType === 'url') {
              return html`<span .innerHTML=${formattedPropValue}></span>`;
            }
            return html`
              <span class="property-label">${capitalizeFirstLetter(prop.name)}:</span>
              <span .innerHTML=${formattedPropValue}></span>
            `;
          })
      : [];

    return html`
      ${when(hasValue, () => html`
        <div class="entry-detail-value" .innerHTML=${formattedValue}></div>
      `)}

      ${when(hasProperties && propertyItems.length > 0, () => html`
        <div class="entry-detail-properties-inline">
          ${map(propertyItems, (item, index) => html`
            <span class="property-item">
              ${item}
              ${index < propertyItems.length - 1 ? html`<span class="property-separator">•</span>` : ''}
            </span>
          `)}
        </div>
      `)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entry-detail-properties': EntryDetailProperties;
  }
}
