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

    .milkdown table {
      border-spacing: 0;
      border-collapse: collapse;
      margin-top: 0;
      margin-bottom: 16px;
      width: max-content; /* Allows horizontal scrolling if too wide */
      max-width: 100%;
      display: block;
      overflow: auto;
    }

    .milkdown table th {
      font-weight: 600;
      background-color: var(--background-alt, #f6f8fa);
    }

    .milkdown table th,
    .milkdown table td {
      padding: 6px 13px;
      border: 1px solid var(--border, #d0d7de);
    }

    .milkdown table tr {
      background-color: var(--background, #ffffff);
      border-top: 1px solid var(--border, #d0d7de);
    }

    /* Zebra striping */
    .milkdown table tr:nth-child(2n) {
      background-color: var(--background-subtle, #f6f8fa);
    }

    /* Dark Mode Adjustments */
    @media (prefers-color-scheme: dark) {
      .milkdown table th {
        background-color: #161b22;
      }
      .milkdown table tr {
        background-color: #0d1117;
      }
      .milkdown table tr:nth-child(2n) {
        background-color: #161b22;
      }
      .milkdown table th,
      .milkdown table td {
        border-color: #30363d;
      }
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
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.5em;
      color: var(--text-primary);
    }

    .milkdown h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 1em 0 0.5em;
      color: var(--text-primary);
    }

    .milkdown h3 {
      font-size: 1.125rem;
      font-weight: 600;
      margin: 1em 0 0.5em;
      color: var(--text-primary);
    }

    .milkdown h4 {
      font-size: 1rem;
      font-weight: 600;
      margin: 1em 0 0.5em;
      color: var(--text-primary);
    }

    .milkdown h5 {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-secondary);
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
