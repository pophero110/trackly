# ADR 0003: Use Tag Names as URL Identifiers

## Status
Accepted

## Context
When representing tags in URLs, we had two options:
1. Use internal UUIDs/IDs: `?tag=abc123def456`
2. Use tag names: `?tag=Morning%20Run`

## Decision
We will use **tag names** (URL-encoded) as identifiers in URLs.

## Rationale
1. **Human-readable**: URLs are immediately understandable (`?tag=Morning%20Run` vs `?tag=xyz789`)
2. **Shareable**: Links are meaningful when shared with others
3. **Debuggable**: Easy to see what tag you're viewing without looking up IDs
4. **Natural**: Matches how users think about their tags

## Constraints
- Tag names must be unique (already enforced by the Store)
- Names must be properly URL-encoded/decoded
- Renaming tags doesn't break shared URLs (names are looked up on each navigation)

## Consequences

### Positive
- URLs like `?tag=Gym%20Workout&view=entries` are self-documenting
- Much better UX when sharing links
- Easier debugging and development

### Negative
- Must handle URL encoding/decoding properly
- Tag renames could break external bookmarks (acceptable trade-off)
- Slightly more complex lookup (by name vs by ID)

## Implementation
1. `URLStateManager.encodeTagName()` / `decodeTagName()` handle encoding
2. `Store.getTagByName()` performs name-based lookups
3. Internal store still uses IDs for relationships (entries → tags)
4. URL layer translates between names and IDs
