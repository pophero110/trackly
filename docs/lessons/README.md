# Lessons Learned

This folder contains detailed documentation of important technical issues, patterns, and learnings encountered during the development of Trackly.

## Index

### 1. [Re-render Side Effects and Fixes](./re-render-side-effects.md)
**Date:** 2025-01-08
**Category:** Performance, UX, Architecture
**Summary:** Investigation and fix for scroll position reset when opening modal panels. Deep dive into reactive store pattern side effects and innerHTML replacement issues.

**Key Topics:**
- Reactive store patterns and cascading effects
- innerHTML replacement side effects
- Three-layer defensive fix strategy
- Performance considerations
- Focus state, event listeners, observers preservation

**Files Changed:**
- `app.ts` - Query-only change detection
- `EntryListComponent.ts` - Scroll preservation
- No API calls triggered by re-renders

**Related Issues:** Scroll reset, UX degradation, performance optimization

---

### 2. [SSR vs CSR Architecture](./ssr-vs-csr-architecture.md)
**Date:** 2025-01-08
**Category:** Architecture, Education
**Summary:** Explanation of Trackly's current Client-Side Rendering (CSR) architecture vs Server-Side Rendering (SSR). Understanding the request flow and architectural decisions.

**Key Topics:**
- CSR vs SSR comparison
- Why Trackly uses CSR
- Request flow and data fetching
- Build process and client-side routing
- When to consider SSR migration

**Related Issues:** Architecture understanding, SSR migration planning

---

## Document Structure

Each lesson document follows this structure:

1. **Problem Overview** - What was the issue and user impact
2. **Root Cause Analysis** - Deep dive into why it happened
3. **Solution** - How we fixed it with code examples
4. **Implications** - What we learned and future considerations
5. **Related Files** - Code locations for reference

---

## Contributing to Lessons

When adding new lesson documents:

1. Use descriptive filenames: `topic-name.md`
2. Include date and context at the top
3. Add code examples with file paths and line numbers
4. Include before/after comparisons
5. Document both the problem and solution
6. Add future improvement suggestions
7. Update this README index

---

## Categories

- **Performance** - Optimization, rendering, API efficiency
- **UX** - User experience issues and fixes
- **Architecture** - Design patterns, architectural decisions
- **Security** - Security issues and hardening
- **Accessibility** - A11y improvements
- **DevOps** - Deployment, CI/CD, infrastructure

---

**Last Updated:** 2025-01-08
