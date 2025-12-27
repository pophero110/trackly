/**
 * URL State Manager - Uses route as the source of truth for app state
 * Path-based routing: /entities/life/entries
 */

type StateChangeCallback = () => void;

export type PanelType = 'log-entry' | 'create-entity' | 'edit-entity' | 'clone-entity' | 'edit-entry' | null;

export class URLStateManager {
    private static listeners: StateChangeCallback[] = [];

    /**
     * Encode entity name for URL path (lowercase, replace spaces with hyphens)
     */
    private static encodeEntityName(name: string): string {
        return name.toLowerCase().replace(/\s+/g, '-');
    }

    /**
     * Parse the current pathname and return route info
     */
    private static parsePathname(): { view: 'home' | 'entities' | 'entries', entitySlug?: string } {
        const path = window.location.pathname;

        // Match /entities
        if (path === '/entities') {
            return { view: 'entities' };
        }

        // Match /entities/:entitySlug/entries
        const entriesMatch = path.match(/^\/entities\/([^/]+)\/entries$/);
        if (entriesMatch) {
            return { view: 'entries', entitySlug: entriesMatch[1] };
        }

        // Default to home
        return { view: 'home' };
    }

    /**
     * Get selected entity name from URL path
     * Needs to match entity slug to actual entity name
     */
    static getSelectedEntityName(): string | null {
        const { entitySlug } = URLStateManager.parsePathname();
        return entitySlug || null;
    }

    /**
     * Get current view from URL path
     */
    static getView(): 'home' | 'entities' | 'entries' {
        const { view } = URLStateManager.parsePathname();
        return view;
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
     * Set selected entity name in URL (deprecated - use showEntryList instead)
     */
    static setSelectedEntityName(entityName: string | null): void {
        if (entityName) {
            const slug = URLStateManager.encodeEntityName(entityName);
            URLStateManager.updatePath(`/entities/${slug}/entries`);
        } else {
            URLStateManager.updatePath('/');
        }
    }

    /**
     * Set current view in URL (deprecated - use specific navigation methods)
     */
    static setView(view: 'home' | 'entities' | 'entries'): void {
        if (view === 'entities') {
            URLStateManager.updatePath('/entities');
        } else if (view === 'home') {
            URLStateManager.updatePath('/');
        }
    }

    /**
     * Navigate to entity entry list
     */
    static showEntryList(entityName: string): void {
        const slug = URLStateManager.encodeEntityName(entityName);
        const params = new URLSearchParams(window.location.search);
        const queryString = params.toString();
        const path = `/entities/${slug}/entries${queryString ? '?' + queryString : ''}`;
        URLStateManager.updatePath(path);
    }

    /**
     * Navigate back to entity grid
     */
    static showGrid(): void {
        URLStateManager.updatePath('/entities');
    }

    static showHome(): void {
        URLStateManager.updatePath('/');
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
     * Update URL path and notify listeners
     */
    private static updatePath(path: string): void {
        window.history.pushState(null, '', path);
        URLStateManager.notifyListeners();
    }

    /**
     * Update URL query parameters and notify listeners
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
