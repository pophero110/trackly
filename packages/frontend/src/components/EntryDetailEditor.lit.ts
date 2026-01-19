import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createMilkdownEditor, destroyEditor } from '../utils/milkdown.js';
import type { Editor } from '@milkdown/core';

/**
 * EntryDetailEditor Lit Component
 * Markdown editor using Milkdown
 * Appends Milkdown directly to the component element
 */
@customElement('entry-detail-editor')
export class EntryDetailEditor extends LitElement {
  @property({ type: String })
  notes: string = '';

  private milkdownEditor: Editor | null = null;

  // Disable Shadow DOM for compatibility with existing global styles
  createRenderRoot() {
    return this;
  }

  async firstUpdated() {
    await this.initializeEditor();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.destroyEditor();
  }

  private async initializeEditor(): Promise<void> {
    try {
      // Append Milkdown editor directly to this component element
      this.milkdownEditor = await createMilkdownEditor(
        this,
        this.notes,
        (markdown: string) => {
          // Dispatch custom event when notes change
          this.dispatchEvent(new CustomEvent('notes-change', {
            detail: { notes: markdown },
            bubbles: true,
            composed: true
          }));
        }
      );
    } catch (error) {
      console.error('[EntryDetailEditor] Failed to initialize Milkdown:', error);
    }
  }

  private destroyEditor(): void {
    if (this.milkdownEditor) {
      destroyEditor(this.milkdownEditor);
      this.milkdownEditor = null;
    }
  }

  render() {
    // Return empty - Milkdown will append to this element directly
    return html``;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entry-detail-editor': EntryDetailEditor;
  }
}
