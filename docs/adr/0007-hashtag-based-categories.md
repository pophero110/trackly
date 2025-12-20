# ADR 0007: Use Hashtag Syntax for Categories

## Status
Accepted

## Context
We needed a way for users to tag entities with categories. Options considered:
- Separate category input field
- Multi-select dropdown
- Tag input with autocomplete
- Hashtags in the name field (e.g., "Morning Run #health #fitness")

## Decision
We will use **hashtag syntax** within the entity name field for specifying categories.

## Rationale
1. **Familiar**: Users already understand hashtags from social media
2. **Fast**: Type naturally while entering name
3. **Simple**: No separate field or UI component needed
4. **Flexible**: Add as many or as few tags as needed
5. **Visual**: Hashtags are visible in the name during typing

## Behavior
- User types: "Morning Run #health #fitness"
- System extracts: name = "Morning Run", categories = ["health", "fitness"]
- Hashtags removed from final display name
- Categories displayed as separate pill/badge elements

## Consequences

### Positive
- Very quick to use (no clicking between fields)
- Intuitive for most users
- Minimal UI complexity
- Can easily add categories while thinking about the entity

### Negative
- Not discoverable (need placeholder text to hint)
- Can't use # symbol in entity names
- Limited to alphanumeric characters in tags (no spaces)
- Could be confusing for non-technical users

## Implementation
1. Regex pattern: `/#(\w+)/g` to extract hashtags
2. Extraction happens on form submit
3. Placeholder text shows example: "e.g., Morning Run #health #fitness"
4. Edit mode pre-populates name field with hashtags included
5. Categories stored as string array on Entity model
