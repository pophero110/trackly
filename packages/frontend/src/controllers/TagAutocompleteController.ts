import { ReactiveController, ReactiveControllerHost } from 'lit';
import type { TagAutocompleteDropdown } from '../components/TagAutocompleteDropdown.lit.js';

/**
 * Options for configuring the TagAutocompleteController
 */
export interface TagAutocompleteOptions {
  /** Returns the input element (input or textarea) to attach autocomplete to */
  getInputElement: () => HTMLInputElement | HTMLTextAreaElement | null;
  /** Returns available tag names for autocomplete suggestions */
  getTagNames: () => string[];
  /** Returns the dropdown component for keyboard handling */
  getDropdown?: () => TagAutocompleteDropdown | undefined;
  /** Called when the input value changes (for reactive bindings) */
  onValueChange?: (value: string) => void;
  /** Set to true for textarea with reactive binding (needs async cursor positioning) */
  asyncCursorPositioning?: boolean;
}

/**
 * TagAutocompleteController - Reactive Controller for hashtag autocomplete
 *
 * Consolidates duplicate autocomplete logic from EntryDetailComponent and EntryListHeader.
 * Handles:
 * - Detecting # trigger in input/textarea
 * - Calculating caret position for dropdown placement
 * - Keyboard navigation forwarding to dropdown
 * - Tag insertion and cursor positioning
 *
 * Usage:
 * ```typescript
 * class MyComponent extends LitElement {
 *   private autocompleteController = new TagAutocompleteController(this, {
 *     getInputElement: () => this.myInput,
 *     getTagNames: () => this.availableTags,
 *     getDropdown: () => this.autocompleteDropdown,
 *     onValueChange: (value) => this.handleValueChange(value),
 *     asyncCursorPositioning: true
 *   });
 * }
 * ```
 */
export class TagAutocompleteController implements ReactiveController {
  private host: ReactiveControllerHost;
  private options: TagAutocompleteOptions;

  // Internal state
  private _open: boolean = false;
  private _query: string = '';
  private _triggerIndex: number = -1;
  private _anchorRect: DOMRect | null = null;

  // Public getters for state
  get open(): boolean { return this._open; }
  get query(): string { return this._query; }
  get anchorRect(): DOMRect | null { return this._anchorRect; }

  constructor(host: ReactiveControllerHost, options: TagAutocompleteOptions) {
    this.host = host;
    this.options = options;
    host.addController(this);
  }

  hostConnected(): void {
    // No initialization needed
  }

  hostDisconnected(): void {
    this.close();
  }

  /**
   * Handle input events - detect # trigger and show autocomplete
   */
  handleInput(e: InputEvent): void {
    const input = e.target as HTMLInputElement | HTMLTextAreaElement;
    const value = input.value;
    const cursorPos = input.selectionStart ?? value.length;

    // Call value change callback if provided
    if (this.options.onValueChange) {
      this.options.onValueChange(value);
    }

    // Find the last # before cursor
    const textBeforeCursor = value.substring(0, cursorPos);
    const hashIndex = textBeforeCursor.lastIndexOf('#');

    if (hashIndex !== -1) {
      const textAfterHash = textBeforeCursor.substring(hashIndex + 1);
      // Only show dropdown if no space after # (tag still being typed)
      if (!textAfterHash.includes(' ')) {
        this._triggerIndex = hashIndex;
        this._query = textAfterHash;
        this._anchorRect = this.getCaretCoordinates(input, cursorPos);
        this._open = true;
        this.host.requestUpdate();
        return;
      }
    }

    this.close();
  }

  /**
   * Handle keydown events - forward to dropdown when open
   * Returns true if the key was consumed by the dropdown
   */
  handleKeydown(e: KeyboardEvent): boolean {
    if (!this._open) {
      return false;
    }

    const dropdown = this.options.getDropdown?.();
    if (dropdown) {
      return dropdown.handleKeydown(e);
    }

    return false;
  }

  /**
   * Handle tag selection from dropdown
   */
  handleTagSelected(tagName: string): void {
    const input = this.options.getInputElement();
    if (!input) return;

    const value = input.value;
    const cursorPos = input.selectionStart ?? value.length;

    // Replace from trigger index to cursor with the selected tag
    const beforeTrigger = value.substring(0, this._triggerIndex);
    const afterCursor = value.substring(cursorPos);
    const newValue = `${beforeTrigger}#${tagName} ${afterCursor}`;

    // Calculate new cursor position
    const newCursorPos = this._triggerIndex + 1 + tagName.length + 1;

    if (this.options.asyncCursorPositioning) {
      // For textarea with reactive binding, update value via callback
      // and set cursor position after the component updates
      if (this.options.onValueChange) {
        this.options.onValueChange(newValue);
      }

      // Use requestAnimationFrame to wait for DOM update
      requestAnimationFrame(() => {
        const inputEl = this.options.getInputElement();
        if (inputEl) {
          inputEl.setSelectionRange(newCursorPos, newCursorPos);
          inputEl.focus();
        }
      });
    } else {
      // For regular input, update value directly
      input.value = newValue;
      input.setSelectionRange(newCursorPos, newCursorPos);
      input.focus();
    }

    this.close();
  }

  /**
   * Close the autocomplete dropdown
   */
  close(): void {
    if (!this._open && this._query === '' && this._triggerIndex === -1) {
      return; // Already closed, no need to update
    }
    this._open = false;
    this._query = '';
    this._triggerIndex = -1;
    this._anchorRect = null;
    this.host.requestUpdate();
  }

  /**
   * Get caret coordinates - auto-detects element type
   */
  private getCaretCoordinates(element: HTMLInputElement | HTMLTextAreaElement, position: number): DOMRect {
    if (element instanceof HTMLTextAreaElement) {
      return this.getCaretCoordinatesTextarea(element, position);
    } else {
      return this.getCaretCoordinatesInput(element, position);
    }
  }

  /**
   * Get caret coordinates for textarea using mirror div technique
   */
  private getCaretCoordinatesTextarea(element: HTMLTextAreaElement, position: number): DOMRect {
    // Create a mirror div to measure caret position
    const mirror = document.createElement('div');
    const style = getComputedStyle(element);

    // Copy textarea styles to mirror
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.width = style.width;
    mirror.style.font = style.font;
    mirror.style.fontSize = style.fontSize;
    mirror.style.fontFamily = style.fontFamily;
    mirror.style.fontWeight = style.fontWeight;
    mirror.style.lineHeight = style.lineHeight;
    mirror.style.padding = style.padding;
    mirror.style.border = style.border;
    mirror.style.boxSizing = style.boxSizing;

    // Get text before cursor and add a span to mark position
    const textBeforeCursor = element.value.substring(0, position);
    mirror.textContent = textBeforeCursor;

    const marker = document.createElement('span');
    marker.textContent = '|';
    mirror.appendChild(marker);

    document.body.appendChild(mirror);

    const elementRect = element.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();

    // Calculate position relative to viewport
    const left = elementRect.left + (markerRect.left - mirrorRect.left);
    const top = elementRect.top + (markerRect.top - mirrorRect.top);

    document.body.removeChild(mirror);

    return new DOMRect(left, top, 0, markerRect.height);
  }

  /**
   * Get caret coordinates for input using mirror span technique
   */
  private getCaretCoordinatesInput(element: HTMLInputElement, position: number): DOMRect {
    // Create a mirror span to measure caret position
    const mirror = document.createElement('span');
    const style = getComputedStyle(element);

    // Copy input styles to mirror
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre';
    mirror.style.font = style.font;
    mirror.style.fontSize = style.fontSize;
    mirror.style.fontFamily = style.fontFamily;
    mirror.style.fontWeight = style.fontWeight;
    mirror.style.letterSpacing = style.letterSpacing;

    // Get text before cursor
    const textBeforeCursor = element.value.substring(0, position);
    mirror.textContent = textBeforeCursor;

    document.body.appendChild(mirror);

    const elementRect = element.getBoundingClientRect();
    const textWidth = mirror.offsetWidth;

    document.body.removeChild(mirror);

    // Calculate position: element left + text width + padding
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const left = elementRect.left + paddingLeft + textWidth;
    const top = elementRect.top;

    return new DOMRect(left, top, 0, elementRect.height);
  }
}
