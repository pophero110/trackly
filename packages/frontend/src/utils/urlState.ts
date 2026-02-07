/**
 * URL State Manager - Uses query parameters as the source of truth for app state
 */

type StateChangeCallback = () => void;

export type ActionType = 'log-entry' | 'edit-entry' | null;

export class URLStateManager {
  private static listeners: StateChangeCallback[] = [];

  /**
   * Encode tag name for URL path (lowercase, replace spaces with hyphens)
   */
  private static encodeTagName(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '-');
  }

  /**
   * Decode tag slug to find actual tag name
   * The encoded value is lowercase with hyphens, we need to find the matching tag
   * Note: This requires access to the store, so it's handled in app.ts instead
   * For now, just return the encoded value and let the caller handle the lookup
   */
  private static decodeTagName(encoded: string): string {
    // The encoded value is already the slug format (lowercase, hyphens)
    // The caller (app.ts) will use store.getTagByName or similar lookup
    return encoded;
  }

  /**
   * Parse the current pathname and return route info
   */
  private static parsePathname(): { view: 'home' | 'entries' } {
    const path = window.location.pathname;

    if (path === '/entries') {
      return { view: 'entries' };
    }

    // Default to home (redirect to /entries)
    return { view: 'home' };
  }

  /**
   * Get selected tag slug from URL query param (?tag=)
   */
  static getSelectedTagName(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('tag');
  }

  /**
   * Get current view from URL path
   */
  static getView(): 'home' | 'entries' {
    const { view } = URLStateManager.parsePathname();
    return view;
  }

  /**
   * Get current action from URL
   */
  static getAction(): ActionType {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');

    if (action === 'log-entry' || action === 'edit-entry') {
      return action;
    }
    return null;
  }

  /**
   * Set selected tag name in URL query param
   */
  static setSelectedTagName(tagName: string | null): void {
    const params = new URLSearchParams(window.location.search);
    if (tagName) {
      params.set('tag', URLStateManager.encodeTagName(tagName));
    } else {
      params.delete('tag');
    }
    const queryString = params.toString();
    const newURL = queryString ? `/entries?${queryString}` : '/entries';
    window.history.pushState(null, '', newURL);
    URLStateManager.notifyListeners();
  }

  /**
   * Set current view in URL
   */
  static setView(view: 'home' | 'entries'): void {
    URLStateManager.updatePath('/entries');
  }

  /**
   * Navigate to tag entry list (/entries?tag=slug)
   */
  static showEntryList(tagName: string): void {
    const slug = URLStateManager.encodeTagName(tagName);
    const params = new URLSearchParams(window.location.search);
    params.set('tag', slug);
    const newURL = `/entries?${params.toString()}`;
    window.history.pushState(null, '', newURL);
    URLStateManager.notifyListeners();
  }

  static showHome(): void {
    // Navigate to /entries with no query parameters (fresh state)
    window.history.pushState(null, '', '/entries');
    URLStateManager.notifyListeners();
  }

  /**
   * Check if currently on an entry detail page (/entries?id=...)
   */
  private static isOnEntryDetail(): boolean {
    const params = new URLSearchParams(window.location.search);
    return params.has('id');
  }

  /**
   * Navigate to entry detail page
   * Appends id param to existing query params
   */
  static showEntryDetail(entryId: string): void {
    const params = new URLSearchParams(window.location.search);
    params.set('id', entryId);
    const newURL = `${window.location.pathname}?${params.toString()}`;

    if (!URLStateManager.isOnEntryDetail()) {
      window.history.pushState(null, '', newURL);
    } else {
      // Already on entry detail - replace instead of push
      window.history.replaceState(null, '', newURL);
    }

    URLStateManager.notifyListeners();
  }

  /**
   * Navigate back by removing id param from query params
   */
  static navigateToOrigin(): void {
    const params = new URLSearchParams(window.location.search);
    params.delete('id');
    const queryString = params.toString();
    const newURL = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;
    window.history.pushState(null, '', newURL);
    URLStateManager.notifyListeners();
  }

  /**
   * Open edit entry panel
   */
  static openEditEntryPanel(entryId: string): void {
    const params = new URLSearchParams(window.location.search);
    params.set('action', 'edit-entry');
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
   * Get tag name from URL query parameter (for log entry panel)
   */
  static getTagParam(): string | null {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('tag');
    return encoded ? URLStateManager.decodeTagName(encoded) : null;
  }

  /**
   * Get multiple hashtag filters from URL
   * Returns array of hashtag names (without # symbol)
   */
  static getHashtagFilters(): string[] {
    const params = new URLSearchParams(window.location.search);
    const hashtags = params.get('hashtags');
    if (hashtags) {
      return hashtags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    }
    return [];
  }

  /**
   * Set multiple hashtag filters in URL
   * Pass array of hashtag names (without # symbol)
   */
  static setHashtagFilters(hashtags: string[]): void {
    const params = new URLSearchParams(window.location.search);

    if (hashtags && hashtags.length > 0) {
      params.set('hashtags', hashtags.join(','));
    } else {
      params.delete('hashtags');
    }

    URLStateManager.updateURL(params);
  }

  /**
   * Add a hashtag to the current filters
   */
  static addHashtagFilter(hashtag: string): void {
    const current = URLStateManager.getHashtagFilters();
    if (!current.includes(hashtag)) {
      URLStateManager.setHashtagFilters([...current, hashtag]);
    }
  }

  /**
   * Remove a hashtag from the current filters
   */
  static removeHashtagFilter(hashtag: string): void {
    const current = URLStateManager.getHashtagFilters();
    const filtered = current.filter(t => t !== hashtag);
    URLStateManager.setHashtagFilters(filtered);
  }

  /**
   * Clear all hashtag filters
   */
  static clearHashtagFilters(): void {
    URLStateManager.setHashtagFilters([]);
  }

  /**
   * Get multiple tag filters from URL
   * Returns array of tag names
   */
  static getTagFilters(): string[] {
    const params = new URLSearchParams(window.location.search);
    const tags = params.get('tags');
    if (tags) {
      return tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    }
    return [];
  }

  /**
   * Set multiple tag filters in URL
   * Pass array of tag names
   */
  static setTagFilters(tags: string[]): void {
    const params = new URLSearchParams(window.location.search);

    if (tags && tags.length > 0) {
      params.set('tags', tags.join(','));
    } else {
      params.delete('tags');
    }

    URLStateManager.updateURL(params);
  }

  /**
   * Add a tag to the current filters
   */
  static addTagFilter(tag: string): void {
    const current = URLStateManager.getTagFilters();
    if (!current.includes(tag)) {
      URLStateManager.setTagFilters([...current, tag]);
    }
  }

  /**
   * Remove a tag from the current filters
   */
  static removeTagFilter(tag: string): void {
    const current = URLStateManager.getTagFilters();
    const filtered = current.filter(t => t !== tag);
    URLStateManager.setTagFilters(filtered);
  }

  /**
   * Clear all tag filters
   */
  static clearTagFilters(): void {
    URLStateManager.setTagFilters([]);
  }

  /**
   * Get sort field from URL (for entries)
   */
  static getSortBy(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('sortBy');
  }

  /**
   * Get sort order from URL (for entries)
   */
  static getSortOrder(): 'asc' | 'desc' | null {
    const params = new URLSearchParams(window.location.search);
    const order = params.get('sortOrder');
    return (order === 'asc' || order === 'desc') ? order : null;
  }

  /**
   * Set sort parameters in URL (for entries)
   */
  static setSort(sortBy: string | null, sortOrder: 'asc' | 'desc' | null): void {
    const params = new URLSearchParams(window.location.search);

    if (sortBy) {
      params.set('sortBy', sortBy);
    } else {
      params.delete('sortBy');
    }

    if (sortOrder) {
      params.set('sortOrder', sortOrder);
    } else {
      params.delete('sortOrder');
    }

    URLStateManager.updateURL(params);
  }

  /**
   * Go back to previous page in history
   */
  static goBack(): void {
    window.history.back();
  }

  /**
   * Close panel
   */
  static closePanel(): void {
    const params = new URLSearchParams(window.location.search);
    params.delete('action');
    params.delete('edit');
    params.delete('entryId');
    URLStateManager.updateURL(params);
  }

  /**
   * Check if search modal should be open
   */
  static isSearchOpen(): boolean {
    const params = new URLSearchParams(window.location.search);
    return params.get('search') === 'true';
  }

  /**
   * Open search modal
   */
  static openSearch(): void {
    const params = new URLSearchParams(window.location.search);
    params.set('search', 'true');
    URLStateManager.updateURL(params);
  }

  /**
   * Close search modal
   * @param options.replace - Use replaceState instead of pushState (avoids adding history entry)
   */
  static closeSearch(options?: { replace?: boolean }): void {
    const params = new URLSearchParams(window.location.search);
    params.delete('search');

    if (options?.replace) {
      const newURL = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState(null, '', newURL);
      URLStateManager.notifyListeners();
    } else {
      URLStateManager.updateURL(params);
    }
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
