import { html, LitElement, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { APIClient } from '../api/client.js';

/**
 * Authentication component for login/register
 * Standalone component that doesn't need Store access
 */
@customElement('auth-component')
export class AuthComponent extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .auth-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
      background: var(--background);
    }

    .auth-card {
      background: var(--card-background);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-ambient);
      padding: 40px;
      max-width: 420px;
      width: 100%;
    }

    .auth-title {
      font-size: 32px;
      font-weight: 700;
      text-align: center;
      color: var(--text-primary);
      margin-bottom: 8px;
      letter-spacing: -0.03em;
    }

    .auth-subtitle {
      text-align: center;
      color: var(--text-secondary);
      margin-bottom: 32px;
      font-size: 16px;
    }

    .auth-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: var(--base-size-24);
      background: var(--background);
      border-radius: var(--radius-sm);
      padding: 4px;
    }

    .auth-tab {
      flex: 1;
      padding: 10px 20px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 14px;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      transition: var(--transition);
    }

    .auth-tab:hover {
      color: var(--text-primary);
    }

    .auth-tab.active {
      background: var(--card-background);
      color: var(--primary);
      box-shadow: var(--shadow-ambient);
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: var(--base-size-16);
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .form-group input {
      padding: 12px var(--base-size-16);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-size: 16px;
      background: var(--background);
      color: var(--text-primary);
      transition: var(--transition);
    }

    .form-group input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }

    .form-group input::placeholder {
      color: var(--text-muted);
    }

    .form-group small {
      font-size: 12px;
      color: var(--text-muted);
    }

    .auth-error {
      padding: 12px;
      background: #fee2e2;
      color: #991b1b;
      border-radius: var(--radius-sm);
      font-size: 14px;
      text-align: center;
    }

    .auth-submit {
      margin-top: 8px;
      padding: 14px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition);
    }

    .auth-submit:hover:not(:disabled) {
      background: var(--primary-hover);
    }

    .auth-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      .auth-error {
        background: rgba(239, 68, 68, 0.15);
        color: #fca5a5;
      }
    }

    :host-context([data-theme="dark"]) .auth-error {
      background: rgba(239, 68, 68, 0.15);
      color: #fca5a5;
    }

    /* Mobile responsiveness */
    @media (max-width: 480px) {
      .auth-card {
        padding: var(--base-size-24);
      }

      .auth-title {
        font-size: 28px;
      }
    }
  `;

  @state()
  private isLoginMode = true;

  @state()
  private isSubmitting = false;

  @state()
  private errorMessage = '';

  connectedCallback(): void {
    super.connectedCallback();
    this.initTheme();
  }

  private initTheme(): void {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }

  private handleSwitchToLogin(): void {
    this.isLoginMode = true;
    this.errorMessage = '';
  }

  private handleSwitchToRegister(): void {
    this.isLoginMode = false;
    this.errorMessage = '';
  }

  private async handleSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    this.errorMessage = '';
    this.isSubmitting = true;

    try {
      if (this.isLoginMode) {
        await APIClient.login(email, password);
      } else {
        await APIClient.register(email, password);
      }
      window.location.reload();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      this.isSubmitting = false;
    }
  }

  render() {
    return html`
      <div class="auth-container">
        <div class="auth-card">
          <h1 class="auth-title">Trackly</h1>
          <p class="auth-subtitle">Track anything, anytime</p>

          <div class="auth-tabs">
            <button
              class="auth-tab ${this.isLoginMode ? 'active' : ''}"
              @click=${this.handleSwitchToLogin}>
              Login
            </button>
            <button
              class="auth-tab ${!this.isLoginMode ? 'active' : ''}"
              @click=${this.handleSwitchToRegister}>
              Register
            </button>
          </div>

          <form class="auth-form" @submit=${this.handleSubmit}>
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
                autocomplete=${this.isLoginMode ? 'current-password' : 'new-password'}
                minlength=${this.isLoginMode ? undefined : 8}
              />
              ${!this.isLoginMode ? html`<small>At least 8 characters</small>` : ''}
            </div>

            ${this.errorMessage ? html`
              <div class="auth-error">${this.errorMessage}</div>
            ` : ''}

            <button
              type="submit"
              class="auth-submit"
              ?disabled=${this.isSubmitting}>
              ${this.isSubmitting
                ? (this.isLoginMode ? 'Logging in...' : 'Creating account...')
                : (this.isLoginMode ? 'Login' : 'Create Account')}
            </button>
          </form>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'auth-component': AuthComponent;
  }
}
