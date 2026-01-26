import { html, LitElement, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createMilkdownEditor, destroyEditor } from '../utils/milkdown.js';
import type { Editor } from '@milkdown/core';

/**
 * EntryDetailEditor Lit Component
 * Markdown editor using Milkdown
 * Appends Milkdown directly to the shadow root
 */
@customElement('entry-detail-editor')
export class EntryDetailEditor extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex: 1;
    }

    .milkdown {
      border: none;
      border-radius: 0;
      padding: 0;
      background: transparent;
      min-height: 300px;
      max-height: 70vh;
      overflow-y: auto;
      overflow-x: hidden;
      flex: 1;
      width: 100%;
      max-width: none;
      font-size: 1rem;
      line-height: 1.6;
      color: var(--text-primary);
    }

    .milkdown:focus,
    .milkdown:focus-within,
    .milkdown *:focus {
      outline: none;
      border: none;
    }

    .milkdown .ProseMirror {
      width: 100%;
      max-width: none;
    }

    .milkdown h1 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5em;
      color: var(--text-primary);
    }

    .milkdown h2 {
      font-size: 1.125rem;
      font-weight: 600;
      margin: 1em 0 0.5em;
      color: var(--text-primary);
    }

    .milkdown h3 {
      font-weight: 600;
      margin: 1em 0 0.5em;
      color: var(--text-primary);
    }

    .milkdown p {
      margin: 0.5em 0;
    }

    .milkdown ul,
    .milkdown ol {
      padding-left: 1.5em;
      margin: 0.5em 0;
    }

    .milkdown li {
      margin: 0.25em 0;
    }

    .milkdown code {
      background: var(--background);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'IBM Plex Mono', 'Courier New', monospace;
      font-size: 0.9em;
    }

    .milkdown pre {
      background: var(--background);
      padding: 12px;
      border-radius: 0;
      overflow-x: auto;
      margin: 1em 0;
    }

    .milkdown pre code {
      background: transparent;
      padding: 0;
    }

    /* Dark mode - prefers-color-scheme */
    @media (prefers-color-scheme: dark) {
      .milkdown {
        background: transparent;
        border-color: var(--border);
        color: var(--text-primary);
      }

      .milkdown code,
      .milkdown pre {
        background: var(--background);
      }
    }

    /* Dark mode - explicit theme */
    :host-context([data-theme="dark"]) .milkdown {
      background: transparent;
      border-color: var(--border);
      color: var(--text-primary);
    }

    :host-context([data-theme="dark"]) .milkdown code,
    :host-context([data-theme="dark"]) .milkdown pre {
      background: var(--background);
    }
  `;

  @property({ type: String })
  notes: string = '';

  private milkdownEditor: Editor | null = null;

  async firstUpdated() {
    await this.initializeEditor();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.destroyEditor();
  }

  private async initializeEditor(): Promise<void> {
    try {
      // Append Milkdown editor to the shadow root
      this.milkdownEditor = await createMilkdownEditor(
        this.renderRoot as HTMLElement,
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
