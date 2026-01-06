/**
 * Toast Notification System
 * Displays temporary notification messages to users
 */

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

class ToastManager {
  private container: HTMLElement | null = null;
  private activeToasts: Set<HTMLElement> = new Set();

  constructor() {
    this.initContainer();
  }

  private initContainer(): void {
    // Create toast container if it doesn't exist
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  }

  show(options: ToastOptions): void {
    const {
      message,
      type = 'info',
      duration = 3000,
      customIcon,
      action
    } = options;

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Use custom icon if provided, otherwise use default
    const icon = customIcon || this.getIcon(type);

    const actionButton = action ? `
            <button class="toast-action" data-action="true">
                ${this.escapeHtml(action.label)}
            </button>
        ` : '';

    toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${icon}</span>
                <span class="toast-message">${this.escapeHtml(message)}</span>
                ${actionButton}
            </div>
        `;

    // Add action button handler if provided
    if (action) {
      const actionBtn = toast.querySelector('.toast-action');
      if (actionBtn) {
        actionBtn.addEventListener('click', () => {
          action.onClick();
          this.dismiss(toast);
        });
      }
    }

    // Add to container
    if (this.container) {
      this.container.appendChild(toast);
      this.activeToasts.add(toast);

      // Trigger animation
      requestAnimationFrame(() => {
        toast.classList.add('toast-show');
      });

      // Auto dismiss
      if (duration > 0) {
        setTimeout(() => {
          this.dismiss(toast);
        }, duration);
      }
    }
  }

  private dismiss(toast: HTMLElement): void {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');

    // Remove from DOM after animation
    setTimeout(() => {
      if (this.container && toast.parentElement === this.container) {
        this.container.removeChild(toast);
        this.activeToasts.delete(toast);
      }
    }, 300); // Match CSS animation duration
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

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  dismissAll(): void {
    this.activeToasts.forEach(toast => this.dismiss(toast));
  }
}

// Singleton instance
const toastManager = new ToastManager();

// Convenience functions
export const toast = {
  success: (message: string, duration?: number) =>
    toastManager.show({ message, type: 'success', duration }),

  error: (message: string, duration?: number) =>
    toastManager.show({ message, type: 'error', duration }),

  info: (message: string, duration?: number) =>
    toastManager.show({ message, type: 'info', duration }),

  warning: (message: string, duration?: number) =>
    toastManager.show({ message, type: 'warning', duration }),

  show: (options: ToastOptions) => toastManager.show(options),

  dismissAll: () => toastManager.dismissAll()
};
