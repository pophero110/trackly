/**
 * Toast Notification System
 * Displays temporary notification messages to users
 */

import type { ToastComponent } from '../components/ToastComponent.lit.js';

export type { ToastType, ToastAction, ToastOptions } from '../components/ToastComponent.lit.js';

class ToastManager {
  private toastComponent: ToastComponent | null = null;

  private getComponent(): ToastComponent {
    if (!this.toastComponent) {
      this.toastComponent = document.querySelector('toast-component');
      if (!this.toastComponent) {
        throw new Error('ToastComponent not found in DOM. Make sure <toast-component> is added to the page.');
      }
    }
    return this.toastComponent;
  }

  show(options: import('../components/ToastComponent.lit.js').ToastOptions): void {
    this.getComponent().show(options);
  }

  dismissAll(): void {
    this.getComponent().dismissAll();
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
