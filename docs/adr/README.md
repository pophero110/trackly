# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Trackly project.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences.

## Format

Each ADR follows this structure:
- **Status**: Accepted, Deprecated, Superseded
- **Context**: What problem are we solving?
- **Decision**: What did we decide?
- **Rationale**: Why did we decide this?
- **Consequences**: What are the positive and negative outcomes?
- **Implementation**: How is this implemented?

## Index

- [ADR-0001](0001-use-web-components.md) - Use Native Web Components
- [ADR-0002](0002-use-url-as-state-source.md) - Use URL as Source of Truth for Navigation State
- [ADR-0003](0003-entity-names-as-url-identifiers.md) - Use Entity Names as URL Identifiers
- [ADR-0004](0004-typescript-without-transpilation.md) - Use TypeScript with No Transpilation
- [ADR-0005](0005-observer-pattern-for-state.md) - Use Observer Pattern for State Management
- [ADR-0006](0006-slide-up-panel-ui-pattern.md) - Use Slide-Up Panel for Forms *(Superseded by ADR-0008)*
- [ADR-0007](0007-hashtag-based-categories.md) - Use Hashtag Syntax for Categories
- [ADR-0008](0008-centered-modal-pattern.md) - Use Centered Modal Pattern for Forms
- [ADR-0009](0009-custom-entity-properties.md) - Custom Entity Properties System
- [ADR-0010](0010-url-title-fetching.md) - Automatic URL Title Fetching

## Creating a New ADR

1. Copy the template below
2. Number it sequentially (next number)
3. Fill in all sections
4. Update this README index

### Template

```markdown
# ADR XXXX: [Title]

## Status
[Proposed | Accepted | Deprecated | Superseded]

## Context
[Describe the problem and constraints]

## Decision
[State the decision clearly]

## Rationale
[Explain why this decision was made]

## Consequences

### Positive
- [List benefits]

### Negative
- [List drawbacks]

## Implementation
[Describe how this is implemented]
```
