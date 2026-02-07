import { Editor, rootCtx, defaultValueCtx, editorViewCtx, serializerCtx, parserCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { nord } from '@milkdown/theme-nord';
import {
  gfm,
  deleteSelectedCellsCommand,
  addRowBeforeCommand,
  addRowAfterCommand,
  addColBeforeCommand,
  addColAfterCommand
} from '@milkdown/preset-gfm';
import { emoji } from '@milkdown/plugin-emoji';
import { indent } from '@milkdown/plugin-indent';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { clipboard } from '@milkdown/plugin-clipboard';
import { history } from '@milkdown/plugin-history';
/**
 * Check if text contains markdown table syntax
 */
function containsMarkdownTable(text: string): boolean {
  // Look for markdown table patterns:
  // | header | header |
  // | --- | --- |
  const lines = text.split('\n');
  let hasSeparator = false;

  for (const line of lines) {
    const trimmed = line.trim();
    // Check for separator row like | --- | --- | or |:---:|:---:|
    if (/^\|(\s*:?-+:?\s*\|)+$/.test(trimmed)) {
      hasSeparator = true;
      break;
    }
  }

  return hasSeparator;
}

/**
 * Check if text looks like CSV/TSV data
 */
function isCSVData(text: string): boolean {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return false;

  // Check if lines have consistent comma or tab separators
  const firstLineCommas = (lines[0].match(/,/g) || []).length;
  const firstLineTabs = (lines[0].match(/\t/g) || []).length;

  if (firstLineCommas === 0 && firstLineTabs === 0) return false;

  const separator = firstLineTabs > firstLineCommas ? '\t' : ',';
  const expectedCols = (lines[0].match(new RegExp(separator === '\t' ? '\t' : ',', 'g')) || []).length + 1;

  // Check that at least 2 lines have similar column count
  let consistentLines = 0;
  for (const line of lines.slice(0, 5)) {
    const cols = (line.match(new RegExp(separator === '\t' ? '\t' : ',', 'g')) || []).length + 1;
    if (Math.abs(cols - expectedCols) <= 1) consistentLines++;
  }

  return consistentLines >= 2;
}

/**
 * Convert CSV/TSV text to markdown table
 */
function csvToMarkdownTable(text: string): string {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return text;

  // Detect separator (tab or comma)
  const firstLineTabs = (lines[0].match(/\t/g) || []).length;
  const firstLineCommas = (lines[0].match(/,/g) || []).length;
  const separator = firstLineTabs > firstLineCommas ? '\t' : ',';

  const rows: string[][] = [];

  for (const line of lines) {
    // Simple CSV parsing (handles basic quoted fields)
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === separator && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    rows.push(cells);
  }

  if (rows.length === 0) return text;

  // Build markdown table
  const colCount = Math.max(...rows.map(r => r.length));
  const mdLines: string[] = [];

  // Header row
  const header = rows[0].map(cell => cell || '').concat(Array(colCount - rows[0].length).fill(''));
  mdLines.push('| ' + header.join(' | ') + ' |');

  // Separator row
  mdLines.push('| ' + Array(colCount).fill('---').join(' | ') + ' |');

  // Data rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i].map(cell => cell || '').concat(Array(colCount - rows[i].length).fill(''));
    mdLines.push('| ' + row.join(' | ') + ' |');
  }

  return mdLines.join('\n');
}

/**
 * Initialize Milkdown editor
 */
export async function createMilkdownEditor(
  container: HTMLElement,
  initialValue: string,
  onChange?: (markdown: string) => void
): Promise<Editor> {
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, container);
      ctx.set(defaultValueCtx, initialValue);

      if (onChange) {
        // Use docUpdated instead of markdownUpdated to handle serialization errors
        ctx.get(listenerCtx).updated((ctx, doc, prevDoc) => {
          // Only process if document actually changed
          if (doc.eq(prevDoc)) return;

          try {
            const serializer = ctx.get(serializerCtx);
            const markdown = serializer(doc);
            onChange(markdown);
          } catch (error) {
            // Handle table serialization errors gracefully
            // This can happen with malformed table structures (e.g., rows with undefined cells)
            console.warn('[Milkdown] Error during markdown serialization:', error);
          }
        });
      }
    })
    .use(nord)
    .use(commonmark)
    .use(gfm)
    .use(emoji)
    .use(indent)
    .use(clipboard)
    .use(listener)
    .use(history)
    .create();

  // Set up table context menu after editor is created
  setupTableContextMenu(editor, container);

  // Set up paste handler for markdown content with tables
  setupMarkdownPasteHandler(editor, container);

  return editor;
}

/**
 * Check if a table row is empty (contains only whitespace or ProseMirror trailing breaks)
 */
function isEmptyTableRow(row: HTMLTableRowElement): boolean {
  const cells = row.querySelectorAll('th, td');
  for (const cell of cells) {
    const text = cell.textContent?.trim() || '';
    if (text !== '') {
      return false;
    }
  }
  return true;
}

/**
 * Remove empty header rows from tables in the container
 * This fixes issues where pasting creates empty header rows
 */
function cleanupEmptyTableRows(container: HTMLElement): void {
  const tables = container.querySelectorAll('table');
  for (const table of tables) {
    const headerRows = table.querySelectorAll('tr[data-is-header="true"]');
    for (const row of headerRows) {
      if (isEmptyTableRow(row as HTMLTableRowElement)) {
        row.remove();
      }
    }
  }
}

/**
 * Set up paste handler that properly handles markdown content with tables
 * This intercepts paste events and parses markdown tables correctly
 */
function setupMarkdownPasteHandler(editor: Editor, container: HTMLElement): void {
  container.addEventListener('paste', (event) => {
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const text = clipboardData.getData('text/plain');
    const html = clipboardData.getData('text/html');

    // Check if this is CSV/TSV data and convert to markdown table
    if (text && isCSVData(text)) {
      event.preventDefault();
      event.stopPropagation();

      const markdownTable = csvToMarkdownTable(text);

      editor.action((ctx) => {
        try {
          const view = ctx.get(editorViewCtx);
          const parser = ctx.get(parserCtx);

          const doc = parser(markdownTable);
          if (doc && doc.content.size > 0) {
            const { state } = view;
            const tr = state.tr.replaceSelectionWith(doc, false);
            view.dispatch(tr);
          }
        } catch (error) {
          console.warn('[Milkdown] Error handling CSV paste:', error);
          const view = ctx.get(editorViewCtx);
          const tr = view.state.tr.insertText(text);
          view.dispatch(tr);
        }
      });
      return;
    }

    // If the plain text contains markdown tables and we have HTML,
    // the HTML conversion might create malformed tables.
    // In this case, prefer to use the plain text as markdown.
    if (text && html && containsMarkdownTable(text)) {
      event.preventDefault();
      event.stopPropagation();

      // Insert the markdown text directly - Milkdown will parse it
      editor.action((ctx) => {
        try {
          const view = ctx.get(editorViewCtx);
          const parser = ctx.get(parserCtx);

          // Parse the markdown text into a document
          const doc = parser(text);
          if (doc && doc.content.size > 0) {
            // Replace the current selection with the parsed content
            const { state } = view;
            const tr = state.tr.replaceSelectionWith(doc, false);
            view.dispatch(tr);
          }
        } catch (error) {
          console.warn('[Milkdown] Error handling markdown paste:', error);
          // Fallback: insert as plain text
          const view = ctx.get(editorViewCtx);
          const tr = view.state.tr.insertText(text);
          view.dispatch(tr);
        }
      });
      return;
    }

    // Clean up empty header rows after paste (delayed to allow DOM update)
    setTimeout(() => {
      cleanupEmptyTableRows(container);
    }, 100);
  }, true); // Use capture phase to intercept before Milkdown's handler
}

/**
 * Set up context menu for table operations
 */
function setupTableContextMenu(editor: Editor, container: HTMLElement): void {
  let menuElement: HTMLElement | null = null;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  const createMenu = () => {
    const menu = document.createElement('div');
    menu.className = 'milkdown-table-menu';
    menu.style.cssText = `
      position: fixed;
      background: var(--background, #fff);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 4px 0;
      z-index: 10000;
      min-width: 160px;
      display: none;
    `;
    container.appendChild(menu);
    return menu;
  };

  const showMenu = (x: number, y: number) => {
    if (!menuElement) {
      menuElement = createMenu();
    }

    const menuItems = [
      { label: 'Add Row Above', action: 'addRowBefore' },
      { label: 'Add Row Below', action: 'addRowAfter' },
      { label: 'Delete Row', action: 'deleteRow' },
      { type: 'separator' },
      { label: 'Add Column Left', action: 'addColBefore' },
      { label: 'Add Column Right', action: 'addColAfter' },
      { label: 'Delete Column', action: 'deleteCol' },
    ];

    menuElement.innerHTML = menuItems.map(item => {
      if (item.type === 'separator') {
        return '<div style="height: 1px; background: var(--border, #e5e7eb); margin: 4px 0;"></div>';
      }
      return `<div class="table-menu-item" data-action="${item.action}" style="
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
        color: var(--text-primary, #111);
        transition: background 0.15s;
      ">${item.label}</div>`;
    }).join('');

    // Add hover effects and click handlers
    menuElement.querySelectorAll('.table-menu-item').forEach(el => {
      el.addEventListener('mouseenter', () => {
        (el as HTMLElement).style.background = 'var(--background-secondary, #f3f4f6)';
      });
      el.addEventListener('mouseleave', () => {
        (el as HTMLElement).style.background = '';
      });
      el.addEventListener('click', () => {
        const action = (el as HTMLElement).dataset.action;
        handleAction(action);
        hideMenu();
      });
    });

    // Position menu within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 160;
    const menuHeight = 220;

    let finalX = x;
    let finalY = y;

    if (x + menuWidth > viewportWidth) finalX = viewportWidth - menuWidth - 8;
    if (y + menuHeight > viewportHeight) finalY = viewportHeight - menuHeight - 8;

    menuElement.style.left = `${Math.max(8, finalX)}px`;
    menuElement.style.top = `${Math.max(8, finalY)}px`;
    menuElement.style.display = 'block';
  };

  const hideMenu = () => {
    if (menuElement) {
      menuElement.style.display = 'none';
    }
  };

  const handleAction = (action: string | undefined) => {
    if (!action) return;

    editor.action((ctx) => {
      switch (action) {
        case 'addRowBefore':
          ctx.get(addRowBeforeCommand.key)();
          break;
        case 'addRowAfter':
          ctx.get(addRowAfterCommand.key)();
          break;
        case 'addColBefore':
          ctx.get(addColBeforeCommand.key)();
          break;
        case 'addColAfter':
          ctx.get(addColAfterCommand.key)();
          break;
        case 'deleteRow':
        case 'deleteCol':
          ctx.get(deleteSelectedCellsCommand.key)();
          break;
      }
    });
  };

  const isInTable = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;
    return target.closest('table') !== null;
  };

  // Context menu (right-click) on desktop
  container.addEventListener('contextmenu', (e) => {
    if (isInTable(e.target)) {
      e.preventDefault();
      showMenu(e.clientX, e.clientY);
    }
  });

  // Long press on mobile
  container.addEventListener('touchstart', (e) => {
    if (isInTable(e.target)) {
      longPressTimer = setTimeout(() => {
        const touch = e.touches[0];
        showMenu(touch.clientX, touch.clientY);
      }, 500);
    }
  });

  container.addEventListener('touchend', () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });

  container.addEventListener('touchmove', () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (menuElement && !menuElement.contains(e.target as Node)) {
      hideMenu();
    }
  });
}

/**
 * Get markdown content from editor
 */
export function getMarkdown(editor: Editor): string {
  return editor.action((ctx) => {
    const editorView = ctx.get(defaultValueCtx);
    return editorView;
  });
}

/**
 * Focus the editor and position cursor at the end
 */
export function focusEditor(editor: Editor): void {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);

    // Focus the view first
    view.focus();

    // Move cursor to the end of the document
    const { state } = view;
    const endPos = state.doc.content.size;
    const $endPos = state.doc.resolve(endPos);

    // Find a valid cursor position near the end
    const selection = state.selection.constructor.near($endPos, -1);
    const transaction = state.tr.setSelection(selection);

    view.dispatch(transaction);
  });
}

/**
 * Destroy editor instance
 */
export function destroyEditor(editor: Editor): void {
  editor.destroy();
}
