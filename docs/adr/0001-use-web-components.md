# ADR 0001: Use Native Web Components

## Status
Accepted

## Context
We needed to choose a component architecture for building the Trackly web application. The main options considered were:
- Native Web Components (Custom Elements API)
- React
- Vue
- Plain JavaScript with no component framework

## Decision
We will use **Native Web Components** with the Custom Elements API.

## Rationale
1. **Zero dependencies**: No framework bloat, faster load times
2. **Standards-based**: Built on web platform standards, future-proof
3. **Browser native**: No transpilation required for modern browsers
4. **Learning opportunity**: Deepens understanding of web platform fundamentals
5. **Simplicity**: For a small personal tracking app, avoiding framework overhead makes sense

## Consequences

### Positive
- Smaller bundle size
- No framework lock-in
- Direct access to DOM APIs
- Better understanding of web standards

### Negative
- Less tooling/ecosystem support compared to React/Vue
- Need to implement patterns that frameworks provide out-of-box (state management, routing)
- Less common in the industry, might be harder for others to contribute

## Implementation
All UI components extend `HTMLElement` or a base `WebComponent` class that provides:
- Lifecycle hooks (connectedCallback, disconnectedCallback)
- Store subscription/unsubscription
- Render method pattern
