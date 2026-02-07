import { Store } from './state/Store.js';
import { storeRegistry } from './state/StoreRegistry.js';
import { URLStateManager } from './utils/urlState.js';
import { AppTabs } from './components/AppTabs.js';
import './components/ModalPanel.lit.js'; // Lit version (self-registering)
import './components/SlidePanel.lit.js'; // Lit version (self-registering)
import './components/ToastComponent.lit.js'; // Lit version (self-registering)
import './components/SearchModal.lit.js'; // Search modal (Cmd+K)
import './components/EntryListComponent.lit.js'; // Lit version (self-registering)
import './components/EntryDetailComponent.lit.js'; // Lit version (self-registering)
import './components/AuthComponent.lit.js'; // Lit version (self-registering)
import { APIClient } from './api/client.js';

/**
 * Main application orchestrator
 */
class TracklyApp {
  private store: Store;

  constructor() {
    this.store = new Store();
    this.init();
  }

  private init(): void {
    // Register store in the global registry for Web Components
    storeRegistry.setStore(this.store);

    // Initialize URL state manager
    URLStateManager.init();

    // Register all Web Components
    this.registerComponents();

    // Set up view routing
    this.setupViewRouting();

    // Set up theme toggle
    this.setupThemeToggle();

    // Set up sign-out button
    this.setupSignOut();

    // Set up logo home link
    this.setupLogoLink();

    // Set up navigation links
    this.setupEntriesLink();
  }

  private setupViewRouting(): void {
    const entryList = document.querySelector('entry-list') as HTMLElement;
    const panel = document.querySelector('modal-panel') as any;

    // Track last loaded sort to prevent infinite reload loop
    let lastSortBy: string | undefined = undefined;
    let lastSortOrder: 'asc' | 'desc' | undefined = undefined;

    const updatePageTitle = (view: string, tagName?: string, entryTitle?: string) => {
      let title = 'Trackly';

      if (entryTitle) {
        title = `${entryTitle} - Trackly`;
      } else if (view === 'entries' && tagName) {
        title = `${tagName} - Trackly`;
      } else if (view === 'entries') {
        title = 'Entries - Trackly';
      }

      document.title = title;
    };

    const updateView = () => {
      const path = window.location.pathname;
      const tagSlug = URLStateManager.getSelectedTagName();
      const actionType = URLStateManager.getAction();

      // Redirect home (/) or /tags to /entries
      if (path === '/' || path === '/tags') {
        URLStateManager.showHome();
        return;
      }

      // Check if we're on an entry detail page (?id= query param)
      // SlidePanel now handles opening/closing automatically based on URL
      const params = new URLSearchParams(window.location.search);
      const entryId = params.get('id');
      if (entryId) {
        // Show entry list in background
        if (entryList) entryList.style.display = 'flex';

        // Update page title
        if (this.store.getIsLoaded()) {
          const entry = this.store.getEntryById(entryId);
          if (entry) {
            const primaryTag = entry.primaryTag;
            const tag = primaryTag ? this.store.getTagById(primaryTag.tagId) : undefined;
            const entryTitle = entry.notes ? entry.notes.split('\n')[0].trim().substring(0, 50) : tag?.name || 'Entry';
            updatePageTitle('entry-detail', undefined, entryTitle);
          }
        }

        // Still handle modal panel state for other forms
        this.updatePanelState(actionType, panel);
        return;
      }

      // Look up tag by slug (case-insensitive match)
      let tag = null;
      if (tagSlug && this.store.getIsLoaded()) {
        const tags = this.store.getTags();
        tag = tags.find(t =>
          t.name.toLowerCase().replace(/\s+/g, '-') === tagSlug.toLowerCase()
        ) || null;
      }

      // Handle view routing
      if (tagSlug) {
        // Show entry list for specific tag
        if (entryList) {
          entryList.style.display = 'flex';

          // Sort entries locally if sort has changed (no API call)
          const sortBy = URLStateManager.getSortBy() || undefined;
          const sortOrder = URLStateManager.getSortOrder() || undefined;
          if (sortBy !== lastSortBy || sortOrder !== lastSortOrder) {
            lastSortBy = sortBy;
            lastSortOrder = sortOrder;
            this.store.sortEntries();
          }
        }

        // Set tag ID if found, or null if still loading
        const targetTagId = tag ? tag.id : null;

        // Only update if changed to avoid infinite loop
        if (this.store.getSelectedTagId() !== targetTagId) {
          this.store.setSelectedTagId(targetTagId);
        }

        // Update page title with tag name
        updatePageTitle('entries', tag?.name);
      } else {
        // All entries view (/entries)
        if (entryList) {
          entryList.style.display = 'flex';

          // Sort entries locally if sort has changed (no API call)
          const sortBy = URLStateManager.getSortBy() || undefined;
          const sortOrder = URLStateManager.getSortOrder() || undefined;
          if (sortBy !== lastSortBy || sortOrder !== lastSortOrder) {
            lastSortBy = sortBy;
            lastSortOrder = sortOrder;
            this.store.sortEntries();
          }
        }
        if (this.store.getSelectedTagId() !== null) {
          this.store.setSelectedTagId(null);
        }

        // Update page title
        updatePageTitle('entries');
      }

      // Handle panel state
      this.updatePanelState(actionType, panel);
    };

    // Subscribe to URL changes
    URLStateManager.subscribe(updateView);

    // Subscribe to store changes (for when data loads)
    this.store.subscribe(updateView);

    // Initial view setup
    updateView();
  }

  private updatePanelState(actionType: any, panel: any): void {
    if (!panel) return;

    if (actionType === 'log-entry') {
      const selectedTagSlug = URLStateManager.getSelectedTagName();
      const tag = selectedTagSlug ? this.store.getTags().find(t =>
        t.name.toLowerCase().replace(/\s+/g, '-') === selectedTagSlug.toLowerCase()
      ) || null : null;

      // Set selected tag in store if found
      if (tag) {
        this.store.setSelectedTagId(tag.id);
      }

      // Open log entry panel
      const formTemplate = document.querySelector('#entry-create-form-template');
      if (formTemplate && !panel.getIsOpen()) {
        const formClone = formTemplate.cloneNode(true) as HTMLElement;
        formClone.removeAttribute('id');
        formClone.style.display = 'block';
        panel.open('Log New Entry', formClone);
      }
    } else {
      // No panel in URL, close if open
      if (panel.getIsOpen()) {
        panel.close();
      }
    }
  }

  private registerComponents(): void {
    // Register custom elements
    customElements.define('app-tabs', AppTabs);
    // modal-panel is registered via @customElement decorator in ModalPanel.lit.ts
    // slide-panel is registered via @customElement decorator in SlidePanel.lit.ts
    // entry-list is registered via @customElement decorator in EntryListComponent.lit.ts
    // entry-detail is registered via @customElement decorator in EntryDetailComponent.lit.ts
  }

  private setupThemeToggle(): void {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (!themeToggleBtn) return;

    const updateIcon = (isDark: boolean) => {
      const icon = themeToggleBtn.querySelector('i');
      if (icon) {
        icon.className = isDark ? 'ph-duotone ph-moon' : 'ph-duotone ph-sun';
      }
    };

    const getEffectiveTheme = (): 'light' | 'dark' => {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    // Initialize theme from localStorage or system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
    updateIcon(getEffectiveTheme() === 'dark');

    // Toggle theme on click
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = getEffectiveTheme();
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateIcon(newTheme === 'dark');
    });

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      // Only update if no manual preference is set
      if (!localStorage.getItem('theme')) {
        updateIcon(e.matches);
      }
    });
  }

  private setupSignOut(): void {
    const signOutBtn = document.getElementById('signout-btn');
    // Handle sign out
    if (signOutBtn) {
      signOutBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to sign out?')) {
          APIClient.logout();
        }
      });
    }
  }

  private setupLogoLink(): void {
    const logoLink = document.getElementById('logo-link');
    if (logoLink) {
      logoLink.addEventListener('click', (e) => {
        e.preventDefault();
        // Navigate to home (recent entries view)
        URLStateManager.showHome();
      });
    }
  }

  private setupEntriesLink(): void {
    const entriesLink = document.getElementById('entries-link');
    if (entriesLink) {
      entriesLink.addEventListener('click', (e) => {
        e.preventDefault();
        // Navigate to entries view (home - all recent entries)
        URLStateManager.showHome();
      });
    }
  }

  getStore(): Store {
    return this.store;
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  if (!APIClient.isAuthenticated()) {
    // Show auth component
    document.body.innerHTML = '<auth-component></auth-component>';
    return;
  }

  // User is authenticated, show main app
  (window as any).app = new TracklyApp();
});

export default TracklyApp;
