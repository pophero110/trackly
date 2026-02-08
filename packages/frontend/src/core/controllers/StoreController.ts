import { ReactiveController, ReactiveControllerHost } from 'lit';
import { Store } from '../state/Store.js';
import { storeRegistry } from '../state/StoreRegistry.js';
import { Unsubscribe } from '../../types/index.js';

/**
 * Selector function type - returns a value derived from the store.
 * The component will only re-render when this value changes.
 */
export type StoreSelector<T> = (store: Store) => T;

export interface StoreControllerOptions<T = unknown> {
  /**
   * Optional selector function. When provided, the component only re-renders
   * when the selector's return value changes (shallow comparison).
   */
  selector?: StoreSelector<T>;
}

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
 *
 * With selector (optimized re-renders):
 * ```typescript
 * class MyComponent extends LitElement {
 *   private storeController = new StoreController(this, {
 *     selector: (store) => ({
 *       entryIds: store.getEntries().map(e => e.id).join(','),
 *       selectedEntityId: store.getSelectedEntityId()
 *     })
 *   });
 * }
 * ```
 */
export class StoreController<T = unknown> implements ReactiveController {
  private host: ReactiveControllerHost;
  private unsubscribe: Unsubscribe | null = null;
  private selector?: StoreSelector<T>;
  private lastSelectedValue?: T;

  public store: Store | null = null;
  public isLoaded: boolean = false;

  constructor(host: ReactiveControllerHost, options?: StoreControllerOptions<T>) {
    this.host = host;
    this.selector = options?.selector;
    host.addController(this);
  }

  private shouldUpdate(): boolean {
    if (!this.selector || !this.store) {
      return true;
    }

    const newValue = this.selector(this.store);
    const hasChanged = !this.shallowEqual(this.lastSelectedValue, newValue);
    this.lastSelectedValue = newValue;
    return hasChanged;
  }

  private shallowEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;

    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) {
        return false;
      }
    }
    return true;
  }

  hostConnected() {
    // Try to get store from registry
    try {
      this.store = storeRegistry.getStore();
      this.isLoaded = this.store.getIsLoaded();

      // Initialize selector value
      if (this.selector && this.store) {
        this.lastSelectedValue = this.selector(this.store);
      }

      // Subscribe to store changes
      this.unsubscribe = this.store.subscribe(() => {
        this.isLoaded = this.store!.getIsLoaded();
        if (this.shouldUpdate()) {
          this.host.requestUpdate();
        }
      });
    } catch (e) {
      // Store not ready yet - register callback
      storeRegistry.onStoreInitialized(() => {
        try {
          this.store = storeRegistry.getStore();
          this.isLoaded = this.store.getIsLoaded();

          // Initialize selector value
          if (this.selector && this.store) {
            this.lastSelectedValue = this.selector(this.store);
          }

          // Subscribe to store changes
          this.unsubscribe = this.store.subscribe(() => {
            this.isLoaded = this.store!.getIsLoaded();
            if (this.shouldUpdate()) {
              this.host.requestUpdate();
            }
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
