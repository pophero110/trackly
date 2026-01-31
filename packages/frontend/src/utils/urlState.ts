/**
 * URL State Manager - Uses route as the source of truth for app state
 * Path-based routing: /tags/life/entries
 */

type StateChangeCallback = () => void;

export type ActionType = 'log-entry' | 'create-tag' | 'edit-tag' | 'clone-tag' | 'edit-entry' | null;

export class URLStateManager {
  private static listeners: StateChangeCallback[] = [];
  private static originUrl: string | null = null;

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
  private static parsePathname(): { view: 'home' | 'tags' | 'entries', tagSlug?: string } {
    const path = window.location.pathname;

    // Match /tags
    if (path === '/tags') {
      return { view: 'tags' };
    }

    // Match /entries (all entries view)
    if (path === '/entries') {
      return { view: 'entries' };
    }

    // Match /tags/:tagSlug/entries
    const entriesMatch = path.match(/^\/tags\/([^/]+)\/entries$/);
    if (entriesMatch) {
      return { view: 'entries', tagSlug: entriesMatch[1] };
    }

    // Default to home (redirect to /entries)
    return { view: 'home' };
  }

  /**
   * Get selected tag name from URL path
   * Needs to match tag slug to actual tag name
   */
  static getSelectedTagName(): string | null {
    const { tagSlug } = URLStateManager.parsePathname();
    return tagSlug || null;
  }

  /**
   * Get current view from URL path
   */
  static getView(): 'home' | 'tags' | 'entries' {
    const { view } = URLStateManager.parsePathname();
    return view;
  }

  /**
   * Get current action from URL
   */
  static getAction(): ActionType {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');

    if (action === 'log-entry' || action === 'create-tag' || action === 'edit-tag' || action === 'clone-tag' || action === 'edit-entry') {
      return action;
    }
    return null;
  }

  /**
   * Get tag name for editing from URL
   */
  static getEditTagName(): string | null {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('edit');
    return encoded ? URLStateManager.decodeTagName(encoded) : null;
  }

  static getCloneTagName(): string | null {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('clone');
    return encoded ? URLStateManager.decodeTagName(encoded) : null;
  }

  /**
   * Set selected tag name in URL (deprecated - use showEntryList instead)
   */
  static setSelectedTagName(tagName: string | null): void {
    if (tagName) {
      const slug = URLStateManager.encodeTagName(tagName);
      URLStateManager.updatePath(`/tags/${slug}/entries`);
    } else {
      URLStateManager.updatePath('/entries');
    }
  }

  /**
   * Set current view in URL (deprecated - use specific navigation methods)
   */
  static setView(view: 'home' | 'tags' | 'entries'): void {
    if (view === 'tags') {
      URLStateManager.updatePath('/tags');
    } else if (view === 'entries') {
      URLStateManager.updatePath('/entries');
    } else if (view === 'home') {
      URLStateManager.updatePath('/entries');
    }
  }

  /**
   * Navigate to tag entry list
   */
  static showEntryList(tagName: string): void {
    const slug = URLStateManager.encodeTagName(tagName);
    const params = new URLSearchParams(window.location.search);
    const queryString = params.toString();
    const path = `/tags/${slug}/entries${queryString ? '?' + queryString : ''}`;
    URLStateManager.updatePath(path);
  }

  /**
   * Navigate back to tag grid
   */
  static showGrid(): void {
    // Navigate to /tags with no query parameters (fresh state)
    window.history.pushState(null, '', '/tags');
    URLStateManager.notifyListeners();
  }

  static showHome(): void {
    // Navigate to /entries with no query parameters (fresh state)
    window.history.pushState(null, '', '/entries');
    URLStateManager.notifyListeners();
  }

  /**
   * Check if currently on an entry detail page
   */
  private static isOnEntryDetail(): boolean {
    return /^\/entries\/[^/]+$/.test(window.location.pathname);
  }

  /**
   * Navigate to entry detail page
   * Saves origin URL on first navigation, uses replaceState on subsequent navigations
   */
  static showEntryDetail(entryId: string): void {
    const path = `/entries/${entryId}`;

    if (!URLStateManager.isOnEntryDetail()) {
      // First time opening entry detail - save origin (current URL without ?search)
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete('search');
      URLStateManager.originUrl = currentUrl.pathname + currentUrl.search;
      window.history.pushState(null, '', path);
    } else {
      // Already on entry detail - replace instead of push
      window.history.replaceState(null, '', path);
    }

    URLStateManager.notifyListeners();
  }

  /**
   * Navigate back to origin URL (where user was before opening entry details)
   */
  static navigateToOrigin(): void {
    if (URLStateManager.originUrl) {
      const origin = URLStateManager.originUrl;
      URLStateManager.originUrl = null;
      window.history.pushState(null, '', origin);
      URLStateManager.notifyListeners();
    } else {
      // Fallback to /entries if no origin saved
      window.history.pushState(null, '', '/entries');
      URLStateManager.notifyListeners();
    }
  }

  /**
   * Open create tag panel
   */
  static openCreateTagPanel(): void {
    const params = new URLSearchParams(window.location.search);
    params.set('action', 'create-tag');
    URLStateManager.updateURL(params);
  }

  /**
   * Open edit tag panel
   */
  static openEditTagPanel(tagName: string): void {
    const params = new URLSearchParams(window.location.search);
    params.set('action', 'edit-tag');
    params.set('edit', URLStateManager.encodeTagName(tagName));
    URLStateManager.updateURL(params);
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
   * Get tag sort field from URL
   * Note: Uses same parameter name as entries (sortBy) since they're on different routes
   */
  static getTagSortBy(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('sortBy');
  }

  /**
   * Get tag sort order from URL
   * Note: Uses same parameter name as entries (sortOrder) since they're on different routes
   */
  static getTagSortOrder(): 'asc' | 'desc' | null {
    const params = new URLSearchParams(window.location.search);
    const order = params.get('sortOrder');
    return (order === 'asc' || order === 'desc') ? order : null;
  }

  /**
   * Set tag sort parameters in URL
   * Note: Uses same parameter names as entries (sortBy/sortOrder) since they're on different routes
   */
  static setTagSort(sortBy: string | null, sortOrder: 'asc' | 'desc' | null): void {
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
