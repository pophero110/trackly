import { APIClient } from '../api/client.js';

/**
 * Authentication component for login/register
 * Standalone component that doesn't need Store access
 */
export class AuthComponent extends HTMLElement {
  private isLoginMode = true;

  connectedCallback(): void {
    this.initTheme();
    this.render();
    this.attachEventListeners();
  }

  private initTheme(): void {
    // Apply saved theme preference on auth page
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }

  private render(): void {
    this.innerHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <h1 class="auth-title">Trackly</h1>
          <p class="auth-subtitle">Track anything, anytime</p>

          <div class="auth-tabs">
            <button
              class="auth-tab ${this.isLoginMode ? 'active' : ''}"
              data-action="switch-login"
            >
              Login
            </button>
            <button
              class="auth-tab ${!this.isLoginMode ? 'active' : ''}"
              data-action="switch-register"
            >
              Register
            </button>
          </div>

          <form class="auth-form" data-action="submit-auth">
            ${!this.isLoginMode ? `
              <div class="form-group">
                <label for="name">Name (optional)</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  autocomplete="name"
                />
              </div>
            ` : ''}

            <div class="form-group">
              <label for="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                required
                autocomplete="email"
              />
            </div>

            <div class="form-group">
              <label for="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                required
                autocomplete="${this.isLoginMode ? 'current-password' : 'new-password'}"
                ${!this.isLoginMode ? 'minlength="8"' : ''}
              />
              ${!this.isLoginMode ? '<small>At least 8 characters</small>' : ''}
            </div>

            <div class="auth-error" style="display: none;"></div>

            <button type="submit" class="btn-primary auth-submit">
              ${this.isLoginMode ? 'Login' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    // Switch to login mode
    this.querySelector('[data-action="switch-login"]')?.addEventListener('click', () => {
      this.isLoginMode = true;
      this.render();
      this.attachEventListeners();
    });

    // Switch to register mode
    this.querySelector('[data-action="switch-register"]')?.addEventListener('click', () => {
      this.isLoginMode = false;
      this.render();
      this.attachEventListeners();
    });

    // Handle form submission
    const form = this.querySelector('[data-action="submit-auth"]') as HTMLFormElement;
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleAuth(form);
    });
  }

  private async handleAuth(form: HTMLFormElement): Promise<void> {
    const formData = new FormData(form);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string | null;

    const errorElement = this.querySelector('.auth-error') as HTMLElement;
    const submitButton = this.querySelector('.auth-submit') as HTMLButtonElement;

    // Reset error
    errorElement.style.display = 'none';
    errorElement.textContent = '';
    submitButton.disabled = true;
    submitButton.textContent = this.isLoginMode ? 'Logging in...' : 'Creating account...';

    try {
      if (this.isLoginMode) {
        await APIClient.login(email, password);
      } else {
        await APIClient.register(email, password, name || undefined);
      }

      // Success - reload the page to show main app
      window.location.reload();
    } catch (error) {
      errorElement.textContent = error instanceof Error ? error.message : 'Authentication failed';
      errorElement.style.display = 'block';
      submitButton.disabled = false;
      submitButton.textContent = this.isLoginMode ? 'Login' : 'Create Account';
    }
  }
}

customElements.define('auth-component', AuthComponent);
