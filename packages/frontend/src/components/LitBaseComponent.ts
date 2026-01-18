import { LitElement, html, TemplateResult } from 'lit';
import { Store } from '../state/Store.js';
import { storeRegistry } from '../state/StoreRegistry.js';
import { Unsubscribe } from '../types/index.js';

/**
 * Base Lit component class for all Lit-based custom elements
 *
 * This class extends LitElement and integrates with the existing Store pattern.
 * It automatically subscribes to store changes and triggers re-renders when the store updates.
 *
 * Usage:
 * ```typescript
 * import { customElement } from 'lit/decorators.js';
 *
 * @customElement('my-component')
 * export class MyComponent extends LitBaseComponent {
 *   render() {
 *     return html`<div>Hello World</div>`;
 *   }
 * }
 * ```
 */
export abstract class LitBaseComponent extends LitElement {
    protected store!: Store;
    protected unsubscribe: Unsubscribe | null;

    constructor() {
        super();
        this.unsubscribe = null;
    }

    /**
     * Called when the element is inserted into the DOM
     * Subscribes to store changes and triggers initial render
     */
    connectedCallback(): void {
        super.connectedCallback();

        // Get store from registry (lazily, after it's been initialized)
        try {
            this.store = storeRegistry.getStore();

            // Subscribe to store changes
            this.unsubscribe = this.store.subscribe(() => this.requestUpdate());
        } catch (e) {
            // Store not yet initialized - register callback to retry when store is ready
            storeRegistry.onStoreInitialized(() => {
                try {
                    this.store = storeRegistry.getStore();
                    this.unsubscribe = this.store.subscribe(() => this.requestUpdate());
                    this.requestUpdate(); // Trigger initial render with store
                } catch (error) {
                    console.error('Failed to get store after initialization:', error);
                }
            });
        }
    }

    /**
     * Called when the element is removed from the DOM
     * Unsubscribes from store changes to prevent memory leaks
     */
    disconnectedCallback(): void {
        super.disconnectedCallback();

        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    /**
     * Disable Shadow DOM by default to maintain compatibility with existing global styles
     * Components can override this method to enable Shadow DOM if needed
     */
    createRenderRoot() {
        return this; // Render in light DOM (no shadow root)
    }

    /**
     * Generate loading state HTML
     * @param message - Loading message to display (e.g., "Loading entities...")
     * @returns Lit TemplateResult for loading state
     */
    protected renderLoadingState(message: string): TemplateResult {
        return html`
            <div class="loading-state">
                <div class="spinner"></div>
                <p>${message}</p>
            </div>
        `;
    }
}
