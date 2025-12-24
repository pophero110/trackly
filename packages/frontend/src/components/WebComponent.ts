import { Store } from '../state/Store.js';
import { storeRegistry } from '../state/StoreRegistry.js';
import { Unsubscribe } from '../types/index.js';

/**
 * Base Web Component class for all custom elements
 */
export abstract class WebComponent extends HTMLElement {
    protected store: Store;
    protected unsubscribe: Unsubscribe | null;

    constructor() {
        super();
        this.store = storeRegistry.getStore();
        this.unsubscribe = null;
    }

    connectedCallback(): void {
        // Subscribe to store changes
        this.unsubscribe = this.store.subscribe(() => this.render());

        // Initial render
        this.render();
    }

    disconnectedCallback(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    abstract render(): void;

    protected attachEventListeners(): void {
        // Override in subclasses if needed
    }
}
