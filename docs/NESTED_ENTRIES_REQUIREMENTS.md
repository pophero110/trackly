# Nested Entry Feature - Requirements & Design Questions

**Date:** December 31, 2025
**Status:** Requirements Gathering
**Feature:** Nested/Hierarchical Entry System with Drag & Drop

## Original Requirement

> Design a nested entry functionality. User can drag and drop an entry to another entry card and become a sub-entry of dropped entry card.

## Purpose

Enable users to create hierarchical relationships between entries through an intuitive drag-and-drop interface, allowing for better organization and grouping of related entries.

---

## Design Questions for Clarification

### 1. Data Model & Hierarchy

#### 1.1 Depth Limits
**Question:** How many levels of nesting should be allowed?

**Options:**
- Unlimited depth (entry → sub-entry → sub-sub-entry...)?
- Limited to 1 level (parent → child only)?
- Limited to N levels (e.g., max 3 levels deep)?

**Considerations:**
- Unlimited depth offers flexibility but increases complexity
- Single level is simpler to implement and understand
- Fixed depth (e.g., 3 levels) balances flexibility with manageable complexity

**Answer:** _[To be provided]_

---

#### 1.2 Parent-Child Relationship
**Questions:**
- Can an entry have multiple parent entries, or only one?
- Can an entry be both a parent (have children) AND a child (have a parent) simultaneously?
- What happens if you try to drag a parent entry into one of its own children? (circular reference prevention)

**Considerations:**
- Multiple parents create a graph structure (more complex)
- Single parent creates a tree structure (simpler, clearer hierarchy)
- Need validation to prevent circular dependencies

**Answer:** _[To be provided]_

---

#### 1.3 Entity Constraints
**Questions:**
- Can sub-entries belong to different entities than their parent?
  - Example: Can an "Exercise" entry have a "Meal" sub-entry?
- Must parent and child be the same entity type?
- Should sub-entries inherit any properties from the parent entity?

**Considerations:**
- Cross-entity nesting offers flexibility for workflow tracking
- Same-entity requirement is simpler and more intuitive
- Property inheritance could reduce data entry but adds complexity

**Answer:** _[To be provided]_

---

### 2. Visual Design & User Experience

#### 2.1 Display & Indentation
**Questions:**
- How should nested entries be displayed in the entry list?
  - Indented tree view (like file explorer)?
  - Expandable/collapsible sections?
  - Always show all levels, or hide by default?
- Should there be visual indicators (icons, lines, arrows) showing the parent-child relationship?

**Considerations:**
- Tree view with indent is familiar but takes horizontal space
- Expand/collapse reduces clutter for large hierarchies
- Visual connectors improve scanability but add visual complexity

**Answer:** _[To be provided]_

---

#### 2.2 Drag & Drop Behavior
**Questions:**
- Should there be a visual drop zone indicator when hovering over a potential parent?
- Can you drag multiple entries at once to create a group of sub-entries?
- What should happen if you drag a parent entry that has children?
  - Move parent only?
  - Move entire tree (parent + all descendants)?
  - Ask user for confirmation?

**Considerations:**
- Drop zone indicators improve discoverability
- Multi-drag adds complexity but improves bulk operations
- Moving entire tree is usually expected behavior but needs clear indication

**Answer:** _[To be provided]_

---

#### 2.3 Mobile Experience
**Questions:**
- Since long-press is already used for context menu, how should nesting work on mobile?
  - Long-press to drag (conflicting with context menu)?
  - Separate "Move to..." menu option?
  - Touch-and-hold then drag (different gesture from context menu)?
  - Dedicated "nest" icon/button on mobile?

**Considerations:**
- Need to avoid gesture conflicts
- Mobile drag-and-drop is less precise than desktop
- Menu-based approach may be more reliable on mobile

**Answer:** _[To be provided]_

---

### 3. Functionality & Features

#### 3.1 Sub-Entry Independence
**Questions:**
- Can sub-entries be viewed/edited independently?
- Can a sub-entry be "promoted" back to a top-level entry?
- Can you move a sub-entry to a different parent?
- Can you drag to "unnest" (make top-level again)?

**Considerations:**
- Independence allows flexibility in entry management
- Promotion/demotion enables restructuring
- Moving between parents supports reorganization

**Answer:** _[To be provided]_

---

#### 3.2 Filtering & Sorting
**Questions:**
- When sorting (newest first, etc.), should parent-child grouping be preserved?
  - Keep children with parent even if sort would separate them?
  - Sort all entries independently, breaking hierarchy display?

- When filtering by hashtag/entity, should it show:
  - Only matching entries (breaking parent-child display)?
  - Matching entries with their full parent chain for context?
  - Matching entries with all their children?

**Considerations:**
- Preserving hierarchy during sort maintains context but breaks strict ordering
- Including parent chain helps understand context of filtered results
- Trade-off between filtering precision and hierarchical context

**Answer:** _[To be provided]_

---

#### 3.3 Actions on Parent Entries
**Questions:**
- If you delete a parent entry, what happens to its children?
  - Delete all children recursively (cascade delete)?
  - Promote children to top-level?
  - Prevent deletion if it has children?
  - Ask user what to do?

- If you archive a parent, should children be archived too?
  - Cascade archive?
  - Keep children active?
  - Ask user?

**Considerations:**
- Cascade operations are convenient but risky (accidental data loss)
- Prompting for confirmation prevents accidents but adds friction
- Preventing operations ensures safety but reduces flexibility

**Answer:** _[To be provided]_

---

### 4. Data & Performance

#### 4.1 Entry Count & Display
**Questions:**
- Should sub-entries count toward the "20 entries" display limit separately?
- When showing "Your Entries (15 entries)", does this include sub-entries in the count?
- How should pagination work with nested structures?
  - Page by top-level entries only?
  - Page by total entry count?
  - Keep parent-child groups together across pages?

**Considerations:**
- Counting affects perceived entry volume
- Pagination with hierarchy needs careful UX design
- May need "expand all" / "collapse all" for large hierarchies

**Answer:** _[To be provided]_

---

#### 4.2 Use Cases
**Question:** What's the primary use case for nesting?

**Examples:**
- Breaking down tasks into subtasks (project management)?
- Grouping related events (e.g., "Workout" with "Warmup", "Main", "Cooldown" sub-entries)?
- Adding context/notes/metadata to an entry?
- Creating threads of related entries (conversation-style)?
- Tracking workflows (e.g., "Order" with "Shipped", "Delivered" sub-entries)?
- Something else?

**Considerations:**
- Use case drives design decisions (depth, constraints, display)
- Different use cases may need different features
- Understanding goals helps prioritize features

**Answer:** _[To be provided]_

---

#### 4.3 Alternative Approaches
**Questions:**
- Have you considered other ways to show relationships between entries?
  - Tags/labels (already have hashtags)?
  - Entry references/links in notes?
  - Entry groups/categories?
  - Timeline/sequence indicators?

- What makes drag-and-drop nesting the preferred solution over these alternatives?

**Considerations:**
- Alternative solutions may be simpler to implement
- Nesting provides visual hierarchy that tags don't
- May benefit from combining approaches (nesting + tags)

**Answer:** _[To be provided]_

---

## Implementation Considerations

### Database Schema Changes

**Potential fields to add to Entry model:**
```typescript
{
  parentId: string | null;          // ID of parent entry (null for top-level)
  depth: number;                     // Nesting depth (0 for top-level)
  position: number;                  // Order within siblings
  hasChildren: boolean;              // Optimization for queries
  childrenCount: number;             // Number of direct children
  path: string;                      // Materialized path (e.g., "1/5/12")
}
```

### API Endpoints Needed

```
POST   /api/entries/:id/nest         - Nest entry under parent
POST   /api/entries/:id/unnest       - Make entry top-level
POST   /api/entries/:id/move         - Move to different parent
GET    /api/entries/:id/children     - Get all children
GET    /api/entries/:id/descendants  - Get entire subtree
```

### Frontend Components

- Drag-and-drop handlers (HTML5 Drag API)
- Drop zone visual indicators
- Nested entry card rendering
- Expand/collapse controls (if needed)
- Indentation styling
- Mobile touch gesture handling

### Performance Optimizations

- Lazy loading of nested levels
- Efficient tree queries (materialized path or nested sets)
- Caching of hierarchy metadata
- Batch operations for moving subtrees

---

## Next Steps

1. ✅ Document requirements and questions
2. ⏳ Gather answers to design questions
3. ⏳ Create detailed technical specification
4. ⏳ Design database schema updates
5. ⏳ Create wireframes/mockups for UI
6. ⏳ Implement backend API changes
7. ⏳ Implement frontend drag-and-drop
8. ⏳ Add mobile gesture support
9. ⏳ Write tests
10. ⏳ User acceptance testing

---

## Related Documents

- [UI Design](./UI_DESIGN.md) - Current UI patterns and design system
- [Architecture](./ARCHITECTURE.md) - System architecture overview
- ADR folder - For architectural decisions related to this feature

---

## Notes

- This feature represents a significant architectural change to the entry model
- Should consider creating an ADR (Architecture Decision Record) once design is finalized
- May want to implement as optional feature flag initially for gradual rollout
- Should consider impact on existing features (sorting, filtering, hashtags, etc.)
