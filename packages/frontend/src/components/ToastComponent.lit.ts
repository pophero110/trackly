import { html, LitElement, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number; // milliseconds, 0 for permanent
  customIcon?: string; // Optional custom SVG icon HTML
  action?: ToastAction; // Optional action button
}

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  customIcon?: string;
  action?: ToastAction;
  visible: boolean;
}

/**
 * ToastComponent - Displays toast notifications
 * Singleton component that manages all toast messages
 */
@customElement('toast-component')
export class ToastComponent extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .toast-container {
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: var(--base-size-16);
      align-items: center;
    }

    .toast {
      pointer-events: auto;
      padding: var(--base-size-16);
      background: white;
      border: none;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transform: scale(0.8);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .toast-show {
      opacity: 1;
      transform: scale(1) !important;
    }

    .toast-hide {
      opacity: 0;
      transform: scale(0.8) !important;
    }

    .toast-content {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .toast-icon {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-weight: bold;
      font-size: 0.875rem;
      margin-right: 12px;
    }

    .toast-message {
      color: var(--text-primary);
      font-size: 0.9375rem;
      line-height: 1.5;
    }

    .toast-action {
      flex-shrink: 0;
      background: none;
      border: none;
      color: var(--primary);
      font-size: 0.875rem;
      font-weight: 600;
      padding: 4px 8px;
      cursor: pointer;
      border-radius: 4px;
      transition: background-color 0.2s;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: center;
    }

    .toast-action:hover {
      background: rgba(0, 0, 0, 0.05);
    }

    .toast-action:active {
      background: rgba(0, 0, 0, 0.1);
    }

    /* Toast type styles */
    .toast-success {
      border-left: 4px solid #10b981;
    }

    .toast-success .toast-icon {
      background: #10b981;
      color: white;
    }

    .toast-error {
      border-left: 4px solid #ef4444;
    }

    .toast-error .toast-icon {
      background: #ef4444;
      color: white;
    }

    .toast-warning {
      border-left: 4px solid #f59e0b;
    }

    .toast-warning .toast-icon {
      background: #f59e0b;
      color: white;
    }

    .toast-info {
      border-left: 4px solid #3b82f6;
    }

    .toast-info .toast-icon {
      background: #3b82f6;
      color: white;
    }

    /* Dark mode - prefers-color-scheme */
    @media (prefers-color-scheme: dark) {
      .toast {
        background: var(--surface, #1f2937);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }

      .toast-action:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .toast-action:active {
        background: rgba(255, 255, 255, 0.15);
      }
    }

    /* Dark mode - explicit theme override */
    :host-context([data-theme="dark"]) .toast {
      background: var(--surface, #1f2937);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    :host-context([data-theme="dark"]) .toast-action:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    :host-context([data-theme="dark"]) .toast-action:active {
      background: rgba(255, 255, 255, 0.15);
    }

    /* Mobile: bottom center */
    @media (max-width: 768px) {
      .toast-container {
        top: auto;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
      }

      .toast {
        min-width: unset;
        max-width: calc(100vw - 32px);
      }
    }
  `;

  @state()
  private toasts: Toast[] = [];

  private nextId = 0;

  /**
   * Show a new toast notification
   */
  show(options: ToastOptions): void {
    const {
      message,
      type = 'info',
      duration = 3000,
      customIcon,
      action
    } = options;

    const id = `toast-${this.nextId++}`;
    const toast: Toast = {
      id,
      message,
      type,
      customIcon,
      action,
      visible: false
    };

    // Add to list
    this.toasts = [...this.toasts, toast];

    // Trigger show animation on next frame
    requestAnimationFrame(() => {
      const toastElement = this.shadowRoot?.querySelector(`[data-toast-id="${id}"]`) as HTMLElement;
      if (toastElement) {
        toastElement.classList.add('toast-show');
      }

      // Update state to mark as visible
      this.toasts = this.toasts.map(t =>
        t.id === id ? { ...t, visible: true } : t
      );
    });

    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }
  }

  /**
   * Dismiss a specific toast
   */
  private dismiss(id: string): void {
    const toastElement = this.shadowRoot?.querySelector(`[data-toast-id="${id}"]`) as HTMLElement;
    if (toastElement) {
      toastElement.classList.remove('toast-show');
      toastElement.classList.add('toast-hide');

      // Remove from array after animation
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== id);
      }, 300); // Match CSS animation duration
    }
  }

  /**
   * Dismiss all toasts
   */
  dismissAll(): void {
    this.toasts.forEach(toast => this.dismiss(toast.id));
  }

  private handleActionClick(toast: Toast): void {
    if (toast.action) {
      toast.action.onClick();
      this.dismiss(toast.id);
    }
  }

  private getIcon(type: ToastType): string {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  }

  render() {
    return html`
      <div class="toast-container">
        ${repeat(
          this.toasts,
          (toast) => toast.id,
          (toast) => html`
            <div
              class="toast toast-${toast.type}"
              data-toast-id="${toast.id}">
              <div class="toast-content">
                <span class="toast-icon">
                  ${toast.customIcon
                    ? html`${toast.customIcon}`
                    : this.getIcon(toast.type)
                  }
                </span>
                <span class="toast-message">${toast.message}</span>
                ${toast.action ? html`
                  <button
                    class="toast-action"
                    @click=${() => this.handleActionClick(toast)}>
                    ${toast.action.label}
                  </button>
                ` : ''}
              </div>
            </div>
          `
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'toast-component': ToastComponent;
  }
}
