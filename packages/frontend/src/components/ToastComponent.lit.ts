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
  @state()
  private toasts: Toast[] = [];

  private nextId = 0;

  // Use Light DOM for compatibility with existing global styles
  createRenderRoot() {
    return this;
  }

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
      const toastElement = this.querySelector(`[data-toast-id="${id}"]`) as HTMLElement;
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
    const toastElement = this.querySelector(`[data-toast-id="${id}"]`) as HTMLElement;
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
