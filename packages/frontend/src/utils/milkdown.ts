import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { nord } from '@milkdown/theme-nord';
import { gfm } from '@milkdown/preset-gfm';
import { emoji } from '@milkdown/plugin-emoji';
import { indent } from '@milkdown/plugin-indent';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { slashFactory } from '@milkdown/plugin-slash';
import { clipboard } from '@milkdown/plugin-clipboard';
import { history } from '@milkdown/plugin-history';
import { createSlashMenu } from './slashPluginView';

const slash = slashFactory('my-slash')

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
      // ctx.set(slash.key, {
      //   view: createSlashMenu
      // })

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
    // .use(slash)
    .use(clipboard)
    .use(listener)
    .use(history)
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
