import { Store } from './Store.js';

/**
 * Global store registry for Web Components
 * Web Components can't receive constructor parameters from customElements.define()
 * so we use a singleton pattern to provide access to the store
 */
class StoreRegistry {
    private static instance: StoreRegistry;
    private store: Store | null = null;

    private constructor() {}

    static getInstance(): StoreRegistry {
        if (!StoreRegistry.instance) {
            StoreRegistry.instance = new StoreRegistry();
        }
        return StoreRegistry.instance;
    }

    setStore(store: Store): void {
        this.store = store;
    }

    getStore(): Store {
        if (!this.store) {
            throw new Error('Store not initialized. Call StoreRegistry.getInstance().setStore() first.');
        }
        return this.store;
    }
}

export const storeRegistry = StoreRegistry.getInstance();
