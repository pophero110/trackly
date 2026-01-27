import { SlashProvider } from '@milkdown/plugin-slash';
import { createTable } from '@milkdown/preset-gfm';
// import { insertHeadline } from '@milkdown/preset-commonmark';

export function createSlashMenu(view) {
  const content = document.createElement('div');
  content.className = 'slash-menu'; // Target this in your Lit CSS

  // Create Menu Items
  const items = [
    { label: 'Table (IPO)', action: () => view.dispatch(createTable.command()) },
    // { label: 'Heading 1', action: () => view.dispatch(insertHeadline.command(1)) },
    // { label: 'Heading 2', action: () => view.dispatch(insertHeadline.command(2)) },
  ];

  // Render Items
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'slash-item';
    btn.textContent = item.label;
    btn.onmousedown = (e) => {
      e.preventDefault(); // Prevent editor from losing focus
      item.action();
      provider.hide(); // Hide menu after selection
    };
    content.appendChild(btn);
  });

  const provider = new SlashProvider({
    content,
  });

  return {
    update: (updatedView, prevState) => {
      provider.update(updatedView, prevState);
    },
    destroy: () => {
      provider.destroy();
      content.remove();
    },
  };
}
