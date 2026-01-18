import { ReactiveController, ReactiveControllerHost } from 'lit';
import { Store } from '../state/Store.js';
import { storeRegistry } from '../state/StoreRegistry.js';
import { Unsubscribe } from '../types/index.js';

/**
 * Reactive Controller for Store integration
 * Handles store initialization, subscription, and cleanup
 *
 * Usage:
 * ```typescript
 * class MyComponent extends LitElement {
 *   private storeController = new StoreController(this);
 *
 *   render() {
 *     const store = this.storeController.store;
 *     if (!store) return html`<p>Loading...</p>`;
 *     // Use store...
 *   }
 * }
 * ```
 */
export class StoreController implements ReactiveController {
  private host: ReactiveControllerHost;
  private unsubscribe: Unsubscribe | null = null;

  public store: Store | null = null;
  public isLoaded: boolean = false;

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  hostConnected() {
    // Try to get store from registry
    try {
      this.store = storeRegistry.getStore();
      this.isLoaded = this.store.getIsLoaded();

      // Subscribe to store changes
      this.unsubscribe = this.store.subscribe(() => {
        this.isLoaded = this.store!.getIsLoaded();
        this.host.requestUpdate();
      });
    } catch (e) {
      // Store not ready yet - register callback
      storeRegistry.onStoreInitialized(() => {
        try {
          this.store = storeRegistry.getStore();
          this.isLoaded = this.store.getIsLoaded();

          // Subscribe to store changes
          this.unsubscribe = this.store.subscribe(() => {
            this.isLoaded = this.store!.getIsLoaded();
            this.host.requestUpdate();
          });

          this.host.requestUpdate();
        } catch (error) {
          console.error('Failed to get store after initialization:', error);
        }
      });
    }
  }

  hostDisconnected() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
