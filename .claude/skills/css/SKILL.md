---
name: css
descriptiion: CSS Best Practices for Single-Developer, Long-Lived Projects
---

## TL;DR Checklist

1. **Organize files simply** — base, components, utilities.
2. **Semantic class names** — short and consistent.
3. **Use CSS variables** for colors, spacing, fonts.
4. **Keep selectors simple** — classes, pseudo-classes, custom elements.
5. **Reusable components** — buttons, cards, modals.
6. **Mobile-first & responsive** — flexbox/grid, avoid fixed px.
7. **Document exceptions and choices** — future you will thank you.
8. **Lint & clean regularly** — prevent CSS entropy.
9. **Prefer simplicity over methodology** — BEM or CUBE lightly if needed.
10. **Accessibility and performance** — colors, focus, animation efficiency.

## 1. Structure & Organization

* **Keep CSS modular:** separate files/folders for base styles, components, utilities, and layout.

  ```
  styles/
  ├── base/
  ├── components/
  ├── layout/
  └── utilities/
  ```
* **Group related rules together** to make them easy to find later.
* Avoid over-architecting with multiple methodologies unless needed.

## 2. Naming Conventions

* Use **semantic, meaningful names**; short and clear.
* **BEM or light BEM** is fine for reusable components but don’t overcomplicate.
* Classes > IDs for styling; avoid inline styles.
* Only use modifiers for real variants or states.

## 3. Reusability & Consistency

* Extract **repeated styles** into variables, utility classes, or mixins.
* Use **CSS variables** for colors, spacing, font sizes:

```css
:root {
  --color-primary: #2563eb;
  --space-s: 8px;
  --font-base: 16px;
}
```

* Prefer **reusable components** (buttons, cards, modals).

## 4. Simplicity in Selectors

* Keep selectors **low-specificity** and flat.
* Avoid deeply nested selectors.
* Use **classes or custom elements** instead of relying on tags.
* Use pseudo-classes/elements only for states or decorations.

## 5. Layout & Responsiveness

* **Mobile-first media queries**.
* Use modern layout systems: **Flexbox, Grid**.
* Avoid fixed pixel sizes; prefer responsive units (`rem`, `%`, `fr`).
* Use container queries if needed.

## 6. Maintainability

* **Document complex or exception rules**.
* Use a **consistent order** of properties.
* Use **linting** (Stylelint) for errors and formatting.
* Keep file size manageable; split logically.

## 7. Performance

* Minimize redundant or overly specific selectors.
* Remove unused CSS over time.
* Prefer `transform` and `opacity` for animations over layout properties.

## 8. Theming & Customization

* **CSS variables** allow easy theme changes.
* For components, expose only necessary variables for customization.
* Avoid overcomplicating with multiple layers if not needed.

## 9. Accessibility

* Maintain sufficient color contrast.
* Keep focus states visible.
* Ensure interactive elements are easily targetable by keyboard.

## 10. Modern CSS Practices

* Use **logical properties** (`margin-inline`, `padding-block`) for better RTL support.
* Use **`@layer`** or simple component separation for modularity.
* Consider **custom elements** if building a component library for reuse.
* Avoid preprocessor overkill; native CSS variables and modern features are often enough for solo projects.

