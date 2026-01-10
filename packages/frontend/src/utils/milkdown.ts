import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { nord } from '@milkdown/theme-nord';
import { listener, listenerCtx } from '@milkdown/plugin-listener';

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
    .use(listener)
    .create();

  return editor;
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
 * Focus the editor
 */
export function focusEditor(editor: Editor): void {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    view.focus();
  });
}

/**
 * Destroy editor instance
 */
export function destroyEditor(editor: Editor): void {
  editor.destroy();
}
