import { html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { createMilkdownEditor, destroyEditor } from '../utils/milkdown.js';
import type { Editor } from '@milkdown/core';

/**
 * EntryDetailEditor Lit Component
 * Markdown editor using Milkdown
 */
@customElement('entry-detail-editor')
export class EntryDetailEditor extends LitElement {
  @property({ type: String })
  notes: string = '';

  @query('#notes-editor-container')
  private editorContainer!: HTMLElement;

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
    if (!this.editorContainer) {
      console.error('[EntryDetailEditor] Editor container not found');
      return;
    }

    try {
      this.milkdownEditor = await createMilkdownEditor(
        this.editorContainer,
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

  /**
   * Update editor content (call when notes prop changes externally)
   */
  async updateContent(newNotes: string): Promise<void> {
    if (this.milkdownEditor && newNotes !== this.notes) {
      this.notes = newNotes;
      // Milkdown will update through its own mechanisms
      // You may need to implement editor.update() based on Milkdown version
    }
  }

  render() {
    return html`
      <div class="entry-detail-editor-wrapper">
        <div id="notes-editor-container" class="entry-detail-notes-editor"></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entry-detail-editor': EntryDetailEditor;
  }
}
