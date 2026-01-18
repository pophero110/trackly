import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LitBaseComponent } from './LitBaseComponent.js';

/**
 * Simple test component to verify Lit setup is working correctly
 * This component demonstrates:
 * - Using the @customElement decorator
 * - Using the @property decorator for reactive properties
 * - Extending LitBaseComponent
 * - Using Lit's html template literal
 * - Accessing the store from LitBaseComponent
 */
@customElement('test-lit-component')
export class TestLitComponent extends LitBaseComponent {
  @property({ type: String })
  message = 'Hello from Lit!';

  @property({ type: Number })
  counter = 0;

  private handleClick() {
    this.counter++;
  }

  render() {
    const entityCount = this.store.getEntities().length;
    const entryCount = this.store.getEntries().length;

    return html`
      <div class="test-lit-component" style="padding: 20px; border: 2px solid #4CAF50; margin: 10px; border-radius: 8px; max-width: 800px; background: #f9fff9;">
        <h3 style="margin-top: 0;">🎉 Lit Component Test</h3>
        <p><strong>Message:</strong> ${this.message}</p>
        <p><strong>Counter:</strong> ${this.counter}</p>
        <button @click=${this.handleClick} style="padding: 8px 16px; cursor: pointer; background: #4CAF50; color: white; border: none; border-radius: 4px;">
          Increment Counter
        </button>

        <hr style="margin: 16px 0;">

        <h4>Store Integration:</h4>
        <p><strong>Entities in store:</strong> ${entityCount}</p>
        <p><strong>Entries in store:</strong> ${entryCount}</p>
        <p><strong>Store loaded:</strong> ${this.store.getIsLoaded() ? '✅' : '⏳'}</p>

        <hr style="margin: 16px 0;">

        <p style="font-size: 12px; color: #666; margin-bottom: 0;">
          ✓ Lit is working<br>
          ✓ Decorators are working (@customElement, @property)<br>
          ✓ LitBaseComponent integration is working<br>
          ✓ Store subscription is working<br>
          ✓ Event handling is working (@click)<br>
          ✓ Reactive properties are working (counter updates on click)
        </p>
      </div>
    `;
  }
}
