import { ReactiveController, ReactiveControllerHost } from 'lit';
import { URLStateManager, ActionType } from '../utils/urlState.js';
import { Unsubscribe } from '../../types/index.js';
import { Store } from '../state/Store.js';
import { storeRegistry } from '../state/StoreRegistry.js';
import { Tag } from '../../modules/tags/models/Tag.js';

/**
 * Route state parsed from URL
 */
export interface RouteState {
  pathname: string;
  view: 'home' | 'entries';
  entryId: string | null;
  tagSlug: string | null;
  action: ActionType;
  sortBy: string | null;
  sortOrder: 'asc' | 'desc' | null;
  tagFilters: string[];
  hashtagFilters: string[];
  isSearchOpen: boolean;
}

/**
 * Route state with resolved tag information
 */
export interface ResolvedRouteState extends RouteState {
  tag: Tag | null;
  entryTitle: string | null;
}

/**
 * Selector function type - returns a value derived from route state.
 * The component will only re-render when this value changes.
 */
export type RouteSelector<T> = (state: RouteState) => T;

export interface RoutingControllerOptions<T> {
  /**
   * Optional selector function. When provided, the component only re-renders
   * when the selector's return value changes (shallow comparison).
   */
  selector?: RouteSelector<T>;

  /**
   * Whether to track sort changes and call onSortChange callback
   */
  trackSortChanges?: boolean;

  /**
   * Callback when sort parameters change
   */
  onSortChange?: (sortBy: string | null, sortOrder: 'asc' | 'desc' | null) => void;

  /**
   * Whether to update page title based on route
   */
  updatePageTitle?: boolean;
}

/**
 * Reactive Controller for URL routing
 * Handles URL subscription, route state parsing, and optional sort change detection
 *
 * Usage:
 * ```typescript
 * class MyComponent extends LitElement {
 *   private routingController = new RoutingController(this);
 *
 *   render() {
 *     const { entryId, tagSlug } = this.routingController.state;
 *     // Use route state...
 *   }
 * }
 * ```
 *
 * With selector (optimized re-renders):
 * ```typescript
 * class MyComponent extends LitElement {
 *   private routingController = new RoutingController(this, {
 *     selector: (state) => state.entryId  // Only re-render when entryId changes
 *   });
 * }
 * ```
 *
 * With sort change tracking:
 * ```typescript
 * class MyApp {
 *   private routingController = new RoutingController(hostAdapter, {
 *     trackSortChanges: true,
 *     onSortChange: (sortBy, sortOrder) => {
 *       this.store.sortEntries();
 *     }
 *   });
 * }
 * ```
 */
export class RoutingController<T = unknown> implements ReactiveController {
  private host: ReactiveControllerHost;
  private unsubscribeUrl: Unsubscribe | null = null;
  private unsubscribeStore: Unsubscribe | null = null;
  private selector?: RouteSelector<T>;
  private lastSelectedValue?: T;
  private options: RoutingControllerOptions<T>;

  // Track last sort values for change detection
  private lastSortBy: string | null = null;
  private lastSortOrder: 'asc' | 'desc' | null = null;

  // Store reference for resolving tags
  private store: Store | null = null;

  public state: RouteState;
  public resolvedState: ResolvedRouteState | null = null;

  constructor(host: ReactiveControllerHost, options?: RoutingControllerOptions<T>) {
    this.host = host;
    this.options = options || {};
    this.selector = options?.selector;
    host.addController(this);

    // Initialize state immediately
    this.state = this.parseRouteState();
  }

  /**
   * Parse current URL into RouteState
   */
  private parseRouteState(): RouteState {
    const params = new URLSearchParams(window.location.search);

    return {
      pathname: window.location.pathname,
      view: URLStateManager.getView(),
      entryId: params.get('id'),
      tagSlug: URLStateManager.getSelectedTagName(),
      action: URLStateManager.getAction(),
      sortBy: URLStateManager.getSortBy(),
      sortOrder: URLStateManager.getSortOrder(),
      tagFilters: URLStateManager.getTagFilters(),
      hashtagFilters: URLStateManager.getHashtagFilters(),
      isSearchOpen: URLStateManager.isSearchOpen(),
    };
  }

  /**
   * Resolve route state with store data (tag lookup, entry title)
   */
  private resolveRouteState(): ResolvedRouteState {
    const state = this.state;
    let tag: Tag | null = null;
    let entryTitle: string | null = null;

    if (this.store && this.store.getIsLoaded()) {
      // Resolve tag by slug
      if (state.tagSlug) {
        const tags = this.store.getTags();
        tag = tags.find(t =>
          t.name.toLowerCase().replace(/\s+/g, '-') === state.tagSlug!.toLowerCase()
        ) || null;
      }

      // Resolve entry title
      if (state.entryId) {
        const entry = this.store.getEntryById(state.entryId);
        if (entry) {
          const primaryTag = entry.primaryTag;
          const entryTag = primaryTag ? this.store.getTagById(primaryTag.tagId) : undefined;
          entryTitle = entry.notes
            ? entry.notes.split('\n')[0].trim().substring(0, 50)
            : entryTag?.name || 'Entry';
        }
      }
    }

    return {
      ...state,
      tag,
      entryTitle,
    };
  }

  /**
   * Update page title based on route state
   */
  private updatePageTitle(): void {
    if (!this.options.updatePageTitle) return;

    const resolved = this.resolvedState || this.resolveRouteState();
    let title = 'Trackly';

    if (resolved.entryTitle) {
      title = `${resolved.entryTitle} - Trackly`;
    } else if (resolved.view === 'entries' && resolved.tag) {
      title = `${resolved.tag.name} - Trackly`;
    } else if (resolved.view === 'entries') {
      title = 'Entries - Trackly';
    }

    document.title = title;
  }

  /**
   * Check if sort has changed and trigger callback
   */
  private checkSortChange(): void {
    if (!this.options.trackSortChanges) return;

    const { sortBy, sortOrder } = this.state;

    if (sortBy !== this.lastSortBy || sortOrder !== this.lastSortOrder) {
      this.lastSortBy = sortBy;
      this.lastSortOrder = sortOrder;
      this.options.onSortChange?.(sortBy, sortOrder);
    }
  }

  /**
   * Check if component should update based on selector
   */
  private shouldUpdate(): boolean {
    if (!this.selector) {
      return true;
    }

    const newValue = this.selector(this.state);
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

  /**
   * Handle URL change
   */
  private onUrlChange = (): void => {
    this.state = this.parseRouteState();
    this.resolvedState = this.resolveRouteState();

    this.checkSortChange();
    this.updatePageTitle();

    if (this.shouldUpdate()) {
      this.host.requestUpdate();
    }
  };

  /**
   * Handle store change (for tag resolution)
   */
  private onStoreChange = (): void => {
    // Re-resolve state when store updates (e.g., when data loads)
    this.resolvedState = this.resolveRouteState();
    this.updatePageTitle();
    this.host.requestUpdate();
  };

  hostConnected() {
    // Initialize state
    this.state = this.parseRouteState();

    // Initialize selector value
    if (this.selector) {
      this.lastSelectedValue = this.selector(this.state);
    }

    // Initialize sort tracking values
    if (this.options.trackSortChanges) {
      this.lastSortBy = this.state.sortBy;
      this.lastSortOrder = this.state.sortOrder;
    }

    // Subscribe to URL changes
    this.unsubscribeUrl = URLStateManager.subscribe(this.onUrlChange);

    // Try to get store for tag resolution
    try {
      this.store = storeRegistry.getStore();
      this.resolvedState = this.resolveRouteState();
      this.updatePageTitle();

      // Subscribe to store changes for re-resolution when data loads
      this.unsubscribeStore = this.store.subscribe(this.onStoreChange);
    } catch (e) {
      // Store not ready yet - register callback
      storeRegistry.onStoreInitialized(() => {
        try {
          this.store = storeRegistry.getStore();
          this.resolvedState = this.resolveRouteState();
          this.updatePageTitle();

          this.unsubscribeStore = this.store.subscribe(this.onStoreChange);
          this.host.requestUpdate();
        } catch (error) {
          console.error('Failed to get store after initialization:', error);
        }
      });
    }
  }

  hostDisconnected() {
    if (this.unsubscribeUrl) {
      this.unsubscribeUrl();
      this.unsubscribeUrl = null;
    }

    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
  }

  /**
   * Get resolved tag from current route
   */
  getTag(): Tag | null {
    return this.resolvedState?.tag || null;
  }

  /**
   * Check if currently viewing entry detail
   */
  isEntryDetailOpen(): boolean {
    return this.state.entryId !== null;
  }

  /**
   * Get computed page title
   */
  getPageTitle(): string {
    const resolved = this.resolvedState || this.resolveRouteState();

    if (resolved.entryTitle) {
      return `${resolved.entryTitle} - Trackly`;
    } else if (resolved.view === 'entries' && resolved.tag) {
      return `${resolved.tag.name} - Trackly`;
    } else if (resolved.view === 'entries') {
      return 'Entries - Trackly';
    }

    return 'Trackly';
  }
}

/**
 * Host adapter for non-Lit classes (like TracklyApp)
 * Implements ReactiveControllerHost interface minimally
 */
export function createHostAdapter(callbacks: {
  requestUpdate: () => void;
}): ReactiveControllerHost {
  const controllers: ReactiveController[] = [];

  return {
    addController(controller: ReactiveController) {
      controllers.push(controller);
    },
    removeController(controller: ReactiveController) {
      const index = controllers.indexOf(controller);
      if (index >= 0) {
        controllers.splice(index, 1);
      }
    },
    requestUpdate() {
      callbacks.requestUpdate();
    },
    get updateComplete() {
      return Promise.resolve(true);
    },
    // Connect all controllers
    _connectControllers() {
      controllers.forEach(c => c.hostConnected?.());
    },
    // Disconnect all controllers
    _disconnectControllers() {
      controllers.forEach(c => c.hostDisconnected?.());
    },
  } as ReactiveControllerHost & {
    _connectControllers: () => void;
    _disconnectControllers: () => void;
  };
}
