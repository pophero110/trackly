# ADR 0009: Custom Tag Properties System

## Status
Accepted

## Context
Initially, tags had a single optional "value" field with a predefined type (e.g., duration for Exercise, rating for Mood). This worked for simple tracking but was too limited for complex use cases.

Example limitations:
- Exercise tag needed to track: sets, reps, weight, duration
- Book tag needed to track: pages read, author, ISBN
- Project tag needed to track: status, priority, deadline

We needed a flexible way to allow users to define custom properties per tag without hardcoding every possible field.

## Decision
We will implement a **dynamic custom properties system** that allows users to define typed properties when creating tags.

## Rationale

### Flexibility
1. **User-defined schema**: Each tag can have unique properties
2. **Type safety**: Each property has a specific value type
3. **Optional vs required**: Properties can be marked as required
4. **No code changes needed**: New use cases don't require code updates

### Scalability
1. **Grows with user needs**: Users discover what they need to track
2. **No predefined limits**: Unlimited properties per tag
3. **Future-proof**: Supports unforeseen tracking requirements

### Simplicity
1. **Same as tag value**: Reuses existing value type system
2. **Consistent UX**: Property inputs work like main value input
3. **Minimal cognitive load**: Users understand types from main value

## Architecture

### Data Model

#### Tag Interface
```typescript
interface TagProperty {
  id: string;              // Unique identifier
  name: string;            // Display name (e.g., "Sets", "Author")
  valueType: ValueType;    // Type: number, text, url, date, etc.
  required?: boolean;      // Whether value is required
  options?: SelectOption[]; // For select-type properties
}

interface ITag {
  id: string;
  name: string;
  type: TagType;
  categories: string[];
  valueType?: ValueType;     // Now optional (tag can have no default value)
  options?: SelectOption[];
  properties?: TagProperty[]; // Array of custom properties
  createdAt: string;
}
```

#### Entry Interface
```typescript
interface IEntry {
  id: string;
  tagId: string;
  tagName: string;
  timestamp: string;
  value?: string | number | boolean;         // Main value (optional)
  valueDisplay?: string;                     // Display text for URLs
  notes: string;
  images?: string[];
  propertyValues?: Record<string, string | number | boolean>;  // Property values by property ID
  propertyValueDisplays?: Record<string, string>;              // Display text for URL properties
  createdAt: string;
}
```

### Supported Property Types

Reuses the existing ValueType system:
- **number**: Numeric input
- **text**: Text input
- **url**: URL input with automatic title fetching
- **checkbox**: Boolean toggle
- **date**: Date picker
- **time**: Time picker
- **duration**: Number input with "minutes" unit
- **rating**: Number input 1-5 with "/5" suffix

### UI Components

#### 1. Tag Form - Property Management
- "Custom Properties" section with "+ Add Property" button
- Clicking opens property modal
- Properties displayed as list with type badges and remove buttons

#### 2. Property Modal
```
┌─────────────────────────────────┐
│ Add Property               × │
├─────────────────────────────────┤
│ Property Name *                 │
│ [e.g., Sets, Reps, Pages]      │
│                                 │
│ Type *                          │
│ [Number ▼]                      │
│                                 │
│ ☐ Required                      │
│                                 │
│ [Add] [Cancel]                  │
└─────────────────────────────────┘
```

#### 3. Entry Form - Property Inputs
- Properties render between main value and notes
- Each property renders as appropriate input type
- Required properties enforce validation

#### 4. Entry Display - Property Values
**Entry List (Full Display)**:
```
╔═══════════════════════════════════╗
║ 12/19/2024 10:30 AM    [Delete]  ║
║ 30 minutes                        ║
╟───────────────────────────────────╢
║ Sets: 3                           ║
║ Reps: 12                          ║
║ Weight: 135                       ║
╟───────────────────────────────────╢
║ Great workout!                    ║
╚═══════════════════════════════════╝
```

**Tag Grid (Compact Display)**:
- Truncated property values
- Abbreviated units
- Only non-empty properties shown

## Implementation Details

### Creating Properties
1. User clicks "+ Add Property" in tag form
2. Property modal opens with form
3. User enters name, selects type, sets required flag
4. Property added to tag.properties array with generated ID
5. Property saved with tag on form submission

### Entering Property Values
1. Entry form renders input for each tag property
2. Input type matches property.valueType
3. Required properties show asterisk and enforce validation
4. Values collected on form submit to propertyValues Record
5. For URL-type properties, title fetching happens asynchronously

### Displaying Property Values
1. Entry cards check if tag.properties exists
2. Filters properties to only show non-empty values
3. Renders each property with label and formatted value
4. Uses propertyValueDisplays for URL titles if available
5. Type-specific formatting (✓/✗ for checkboxes, units for duration/rating)

### Storage
- Properties stored in tag as array: `Tag.properties`
- Property values stored in entry as Record: `Entry.propertyValues`
- Uses property ID as key for values: `{ "prop-abc123": 3, "prop-def456": "https://..." }`
- URL titles stored separately: `Entry.propertyValueDisplays`

## Consequences

### Positive
- **Extreme flexibility**: Users can track anything
- **No backend needed**: Schema defined in tag, values in entry
- **Type safety**: Value types prevent incorrect data
- **Reuses existing code**: ValueType config, input components, formatters
- **Scalable**: Handles 0 to 100+ properties per tag
- **Backwards compatible**: Tags without properties continue working

### Negative
- **localStorage limits**: Many properties = more data per entry
- **No schema migration**: Changing property types affects old entries
- **Validation complexity**: Required properties must be validated
- **Display complexity**: Many properties make cards cluttered
- **No property reordering**: Properties display in creation order

### Trade-offs
- **Flexibility vs structure**: Users can create chaotic schemas
- **Complexity vs simplicity**: More powerful but more to learn
- **Storage vs features**: Each property adds to localStorage usage

## Validation Rules

1. **Property name**: Required, non-empty string
2. **Property type**: Required, must be valid ValueType
3. **Property values**: Validated based on type (number, URL, etc.)
4. **Required properties**: Must have non-empty value in entry form

## Future Enhancements

### Short-term
1. **Reorder properties**: Drag and drop in property list
2. **Edit properties**: Modify name/type/required after creation
3. **Property templates**: Predefined property sets for common tags
4. **Property groups**: Organize related properties visually

### Long-term
1. **Computed properties**: Properties derived from other properties
2. **Property constraints**: Min/max, regex patterns, custom validation
3. **Multi-select properties**: Array values instead of single values
4. **Nested properties**: Object-type properties with sub-properties
5. **Property metadata**: Description, help text, units

## Related Decisions
- [ADR-0010: URL Title Fetching](0010-url-title-fetching.md) - Automatic titles for URL properties
- Property system reuses value type infrastructure

## Migration Path
1. Existing tags: `properties: []` (empty array)
2. Existing entries: `propertyValues: {}` (empty record)
3. No data migration needed
4. Feature is additive, not breaking
