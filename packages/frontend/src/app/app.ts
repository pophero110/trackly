import { Store } from '../core/state/Store.js';
import { storeRegistry } from '../core/state/StoreRegistry.js';
import { URLStateManager, ActionType } from '../core/utils/urlState.js';
import { RoutingController, createHostAdapter } from '../core/controllers/RoutingController.js';
import '../ui-kit/overlays/ModalPanel.lit.js';
import '../ui-kit/overlays/SlidePanel.lit.js';
import '../ui-kit/overlays/ToastComponent.lit.js';
import '../modules/search/components/SearchModal.lit.js';
import '../modules/entries/components/EntryListComponent.lit.js';
import '../modules/entries/components/EntryDetailComponent.lit.js';
import '../modules/auth/components/AuthComponent.lit.js';
import { APIClient } from '../core/api/client.js';
import { ReactiveControllerHost } from 'lit';

/**
 * Main application orchestrator
 */
class TracklyApp {
  private store: Store;
  private hostAdapter: ReactiveControllerHost & {
    _connectControllers: () => void;
    _disconnectControllers: () => void;
  };
  private routingController: RoutingController;

  constructor() {
    this.store = new Store();

    // Create host adapter for the routing controller
    this.hostAdapter = createHostAdapter({
      requestUpdate: () => this.onRouteChange(),
    });

    // Create routing controller with sort tracking and page title updates
    this.routingController = new RoutingController(this.hostAdapter, {
      trackSortChanges: true,
      onSortChange: () => {
        this.store.sortEntries();
      },
      updatePageTitle: true,
    });

    this.init();
  }

  private init(): void {
    // Register store in the global registry for Web Components
    storeRegistry.setStore(this.store);

    // Initialize URL state manager
    URLStateManager.init();

    // Connect the routing controller (starts URL subscription)
    this.hostAdapter._connectControllers();

    // Set up initial view
    this.setupInitialView();

    // Set up theme toggle
    this.setupThemeToggle();

    // Set up sign-out button
    this.setupSignOut();

    // Set up logo home link
    this.setupLogoLink();

    // Set up navigation links
    this.setupEntriesLink();
  }

  /**
   * Called when route changes (via routing controller)
   */
  private onRouteChange(): void {
    const state = this.routingController.state;
    const entryList = document.querySelector('entry-list') as HTMLElement;
    const panel = document.querySelector('modal-panel') as any;

    // Redirect home (/) or /tags to /entries
    if (state.pathname === '/' || state.pathname === '/tags') {
      URLStateManager.showHome();
      return;
    }

    // Show entry list (it's always visible in the background)
    if (entryList) {
      entryList.style.display = 'flex';
    }

    // Handle tag selection
    if (!state.entryId) {
      const tag = this.routingController.getTag();
      const targetTagId = tag ? tag.id : null;

      // Only update if changed to avoid infinite loop
      if (this.store.getSelectedTagId() !== targetTagId) {
        this.store.setSelectedTagId(targetTagId);
      }
    }

    // Handle modal panel state for log-entry action
    this.updatePanelState(state.action, panel);
  }

  /**
   * Set up initial view on app load
   */
  private setupInitialView(): void {
    // Trigger initial route change
    this.onRouteChange();
  }

  private updatePanelState(actionType: ActionType, panel: any): void {
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
