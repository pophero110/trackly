/**
 * URL State Manager - Uses route as the source of truth for app state
 */

type StateChangeCallback = () => void;

export type PanelType = 'log-entry' | 'create-entity' | 'edit-entity' | 'clone-entity' | 'edit-entry' | null;

export class URLStateManager {
    private static listeners: StateChangeCallback[] = [];

    /**
     * Encode entity name for URL
     */
    private static encodeEntityName(name: string): string {
        return encodeURIComponent(name);
    }

    /**
     * Decode entity name from URL
     */
    private static decodeEntityName(encoded: string): string {
        return decodeURIComponent(encoded);
    }

    /**
     * Get selected entity name from URL
     */
    static getSelectedEntityName(): string | null {
        const params = new URLSearchParams(window.location.search);
        const encoded = params.get('entity');
        return encoded ? URLStateManager.decodeEntityName(encoded) : null;
    }

    /**
     * Get current view from URL
     */
    static getView(): 'home' | 'entities' | 'entries' {
        const params = new URLSearchParams(window.location.search);
        const view = params.get('view');
        if (view === 'entries') return 'entries';
        if (view === 'entities') return 'entities';
        return 'home';
    }

    /**
     * Get current panel from URL
     */
    static getPanel(): PanelType {
        const params = new URLSearchParams(window.location.search);
        const panel = params.get('panel');

        if (panel === 'log-entry' || panel === 'create-entity' || panel === 'edit-entity' || panel === 'clone-entity' || panel === 'edit-entry') {
            return panel;
        }
        return null;
    }

    /**
     * Get entity name for editing from URL
     */
    static getEditEntityName(): string | null {
        const params = new URLSearchParams(window.location.search);
        const encoded = params.get('edit');
        return encoded ? URLStateManager.decodeEntityName(encoded) : null;
    }

    static getCloneEntityName(): string | null {
        const params = new URLSearchParams(window.location.search);
        const encoded = params.get('clone');
        return encoded ? URLStateManager.decodeEntityName(encoded) : null;
    }

    /**
     * Set selected entity name in URL
     */
    static setSelectedEntityName(entityName: string | null): void {
        const params = new URLSearchParams(window.location.search);

        if (entityName) {
            params.set('entity', URLStateManager.encodeEntityName(entityName));
        } else {
            params.delete('entity');
        }

        URLStateManager.updateURL(params);
    }

    /**
     * Set current view in URL
     */
    static setView(view: 'home' | 'entities' | 'entries'): void {
        const params = new URLSearchParams(window.location.search);

        if (view === 'entries') {
            params.set('view', 'entries');
        } else if (view === 'entities') {
            params.set('view', 'entities');
        } else {
            params.delete('view');
        }

        URLStateManager.updateURL(params);
    }

    /**
     * Navigate to entity entry list
     */
    static showEntryList(entityName: string): void {
        const params = new URLSearchParams();
        params.set('entity', URLStateManager.encodeEntityName(entityName));
        params.set('view', 'entries');
        URLStateManager.updateURL(params);
    }

    /**
     * Navigate back to entity grid
     */
    static showGrid(): void {
        const params = new URLSearchParams();
        params.set('view', 'entities');
        URLStateManager.updateURL(params);
    }

    static showHome(): void {
        URLStateManager.updateURL(new URLSearchParams());
    }

    /**
     * Open log entry panel
     */
    static openLogEntryPanel(entityName?: string): void {
        const params = new URLSearchParams(window.location.search);
        params.set('panel', 'log-entry');

        if (entityName) {
            params.set('entity', URLStateManager.encodeEntityName(entityName));
        }

        URLStateManager.updateURL(params);
    }

    /**
     * Open create entity panel
     */
    static openCreateEntityPanel(): void {
        const params = new URLSearchParams(window.location.search);
        params.set('panel', 'create-entity');
        URLStateManager.updateURL(params);
    }

    /**
     * Open edit entity panel
     */
    static openEditEntityPanel(entityName: string): void {
        const params = new URLSearchParams(window.location.search);
        params.set('panel', 'edit-entity');
        params.set('edit', URLStateManager.encodeEntityName(entityName));
        URLStateManager.updateURL(params);
    }

    /**
     * Open clone entity panel
     */
    static openCloneEntityPanel(entityName: string): void {
        const params = new URLSearchParams(window.location.search);
        params.set('panel', 'clone-entity');
        params.set('clone', URLStateManager.encodeEntityName(entityName));
        URLStateManager.updateURL(params);
    }

    /**
     * Open edit entry panel
     */
    static openEditEntryPanel(entryId: string): void {
        const params = new URLSearchParams(window.location.search);
        params.set('panel', 'edit-entry');
        params.set('entryId', entryId);
        URLStateManager.updateURL(params);
    }

    /**
     * Get entry ID from URL
     */
    static getEntryId(): string | null {
        const params = new URLSearchParams(window.location.search);
        return params.get('entryId');
    }

    /**
     * Get hashtag filter from URL
     */
    static getHashtagFilter(): string | null {
        const params = new URLSearchParams(window.location.search);
        return params.get('hashtag');
    }

    /**
     * Set hashtag filter in URL
     */
    static setHashtagFilter(hashtag: string | null): void {
        const params = new URLSearchParams(window.location.search);

        if (hashtag) {
            params.set('hashtag', hashtag);
        } else {
            params.delete('hashtag');
        }

        URLStateManager.updateURL(params);
    }

    /**
     * Close panel
     */
    static closePanel(): void {
        const params = new URLSearchParams(window.location.search);
        params.delete('panel');
        params.delete('edit');
        params.delete('entryId');
        URLStateManager.updateURL(params);
    }

    /**
     * Update URL and notify listeners
     */
    private static updateURL(params: URLSearchParams): void {
        const newURL = params.toString()
            ? `${window.location.pathname}?${params.toString()}`
            : window.location.pathname;

        window.history.pushState(null, '', newURL);
        URLStateManager.notifyListeners();
    }

    /**
     * Subscribe to URL state changes
     */
    static subscribe(callback: StateChangeCallback): () => void {
        URLStateManager.listeners.push(callback);

        // Return unsubscribe function
        return () => {
            URLStateManager.listeners = URLStateManager.listeners.filter(
                (listener) => listener !== callback
            );
        };
    }

    /**
     * Notify all listeners of state change
     */
    private static notifyListeners(): void {
        URLStateManager.listeners.forEach((callback) => {
            callback();
        });
    }

    /**
     * Initialize URL state manager
     */
    static init(): void {
        // Listen for browser back/forward navigation
        window.addEventListener('popstate', () => {
            URLStateManager.notifyListeners();
        });
    }
}
