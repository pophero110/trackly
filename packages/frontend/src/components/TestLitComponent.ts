import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { StoreController } from '../controllers/StoreController.js';

/**
 * Simple test component to verify Lit setup is working correctly
 * This component demonstrates:
 * - Using the @customElement decorator
 * - Using the @property decorator for reactive properties
 * - Using Reactive Controllers (StoreController)
 * - Using Lit's html template literal
 * - Accessing the store via StoreController
 */
@customElement('test-lit-component')
export class TestLitComponent extends LitElement {
  private storeController = new StoreController(this);

  @property({ type: String })
  message = 'Hello from Lit!';

  @property({ type: Number })
  counter = 0;

  // Disable Shadow DOM for compatibility with existing global styles
  createRenderRoot() {
    return this;
  }

  private handleClick() {
    this.counter++;
  }

  render() {
    if (!this.storeController.store || !this.storeController.isLoaded) {
      return html`
        <div class="test-lit-component" style="padding: 20px; border: 2px solid #FFA500; margin: 10px; border-radius: 8px; max-width: 800px; background: #fff9f0;">
          <h3 style="margin-top: 0;">⏳ Lit Component Test</h3>
          <p>Waiting for store to initialize...</p>
        </div>
      `;
    }

    const entityCount = this.storeController.store.getEntities().length;
    const entryCount = this.storeController.store.getEntries().length;

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
        <p><strong>Store loaded:</strong> ${this.storeController.isLoaded ? '✅' : '⏳'}</p>

        <hr style="margin: 16px 0;">

        <p style="font-size: 12px; color: #666; margin-bottom: 0;">
          ✓ Lit is working<br>
          ✓ Decorators are working (@customElement, @property)<br>
          ✓ Reactive Controllers are working (StoreController)<br>
          ✓ Store subscription is working<br>
          ✓ Event handling is working (@click)<br>
          ✓ Reactive properties are working (counter updates on click)
        </p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-lit-component': TestLitComponent;
  }
}
