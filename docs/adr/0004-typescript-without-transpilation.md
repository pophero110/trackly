# ADR 0004: Use TypeScript with No Transpilation

## Status
Accepted

## Context
We needed to decide on the development language and build approach:
- Plain JavaScript (no build step)
- TypeScript with transpilation to ES5
- TypeScript targeting modern ES modules (no polyfills)

## Decision
We will use **TypeScript targeting ES2020+ with native ES modules**, no transpilation or bundling.

## Rationale
1. **Type safety**: Catch bugs at compile time
2. **Modern browsers**: Target audience uses modern browsers
3. **No bundler**: Simpler development setup, faster builds
4. **Native modules**: Browser-native ES module loading
5. **Development speed**: Only type-checking, no transformations

## Build Configuration
```json
{
  "target": "ES2020",
  "module": "ES2020",
  "moduleResolution": "node"
}
```

## Consequences

### Positive
- Fast compilation (type-checking only)
- No webpack/rollup complexity
- No polyfills needed
- Source maps not needed (TS compiles 1:1 to JS)
- Smaller build output

### Negative
- Won't work in older browsers (IE11, old Safari)
- No code minification
- No tree-shaking
- Manual file extension management (.js in imports)

## Trade-offs Accepted
For a personal project targeting modern browsers, the simplicity and speed benefits outweigh the compatibility concerns.

## Implementation
- TypeScript compiler (`tsc`) is the only build tool
- Compiled output in `dist/` mirrors `src/` structure
- Import statements use `.js` extensions (for runtime)
- Development server serves static files, no hot reload
