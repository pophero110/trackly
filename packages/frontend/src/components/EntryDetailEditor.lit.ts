import { html, LitElement, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createMilkdownEditor, destroyEditor, focusEditor } from '../utils/milkdown.js';
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

    /* ProseMirror table wrapper - required for table rendering */
    .ProseMirror .tableWrapper {
      overflow-x: scroll;
      margin: 1em 0;
    }

    .ProseMirror table,
    .milkdown table {
      margin-top: 0;
      margin-bottom: 16px;
      display: block;
      overflow-x: auto;
      max-width: 100%;
    }

    .ProseMirror table tbody,
    .milkdown table tbody {
      display: table;
      border-spacing: 0;
      border-collapse: collapse;
      width: max-content;
    }

    .ProseMirror td,
    .ProseMirror th,
    .milkdown table th,
    .milkdown table td {
      vertical-align: top;
      box-sizing: border-box;
      position: relative;
      padding: 6px 13px;
      border: 1px solid var(--border);
      min-width: 1em;
      white-space: nowrap;
    }

    /* Header row (first row with th cells) */
    .ProseMirror th,
    .milkdown table th {
      font-weight: 600;
      background-color: var(--background);
    }

    /* All table rows - base background */
    .ProseMirror tr,
    .milkdown table tr {
      background-color: var(--card-background);
    }

    /* Header row override */
    .ProseMirror tr:first-child,
    .milkdown table tr:first-child {
      background-color: var(--background);
    }

    /* Zebra striping - every other data row (skip header, start from 3rd row) */
    .ProseMirror tr:nth-child(2n+3),
    .milkdown table tr:nth-child(2n+3) {
      background-color: var(--background);
    }

    /* Column resize handle */
    .ProseMirror .column-resize-handle {
      position: absolute;
      right: -2px;
      top: 0;
      bottom: 0;
      width: 4px;
      z-index: 20;
      background-color: var(--primary);
      pointer-events: none;
    }

    .ProseMirror.resize-cursor {
      cursor: ew-resize;
      cursor: col-resize;
    }

    /* Selected cell highlight */
    .ProseMirror .selectedCell:after {
      z-index: 2;
      position: absolute;
      content: '';
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
      background: rgba(200, 200, 255, 0.4);
      pointer-events: none;
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

      // Auto-focus the editor
      if (this.milkdownEditor) {
        focusEditor(this.milkdownEditor);
      }
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
