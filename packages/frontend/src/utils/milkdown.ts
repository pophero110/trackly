import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core';
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
        ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
          onChange(markdown);
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

  return editor;
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
