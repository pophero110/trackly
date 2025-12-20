# ADR 0003: Use Entity Names as URL Identifiers

## Status
Accepted

## Context
When representing entities in URLs, we had two options:
1. Use internal UUIDs/IDs: `?entity=abc123def456`
2. Use entity names: `?entity=Morning%20Run`

## Decision
We will use **entity names** (URL-encoded) as identifiers in URLs.

## Rationale
1. **Human-readable**: URLs are immediately understandable (`?entity=Morning%20Run` vs `?entity=xyz789`)
2. **Shareable**: Links are meaningful when shared with others
3. **Debuggable**: Easy to see what entity you're viewing without looking up IDs
4. **Natural**: Matches how users think about their entities

## Constraints
- Entity names must be unique (already enforced by the Store)
- Names must be properly URL-encoded/decoded
- Renaming entities doesn't break shared URLs (names are looked up on each navigation)

## Consequences

### Positive
- URLs like `?entity=Gym%20Workout&view=entries` are self-documenting
- Much better UX when sharing links
- Easier debugging and development

### Negative
- Must handle URL encoding/decoding properly
- Entity renames could break external bookmarks (acceptable trade-off)
- Slightly more complex lookup (by name vs by ID)

## Implementation
1. `URLStateManager.encodeEntityName()` / `decodeEntityName()` handle encoding
2. `Store.getEntityByName()` performs name-based lookups
3. Internal store still uses IDs for relationships (entries → entities)
4. URL layer translates between names and IDs
