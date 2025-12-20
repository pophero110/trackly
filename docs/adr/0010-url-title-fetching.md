# ADR 0010: Automatic URL Title Fetching

## Status
Accepted

## Context
Users frequently log URLs in Trackly:
- Articles they read (Article entity)
- Research papers (Paper entity)
- Project links (Project entity)
- Reference materials (Node entity)
- URL-type custom properties

Raw URLs are not user-friendly:
- Hard to scan: `https://www.example.com/blog/2024/12/very-long-url-slug-here`
- No context: URL doesn't indicate content
- Poor readability: Especially in lists/grids

We needed a way to automatically fetch and display meaningful page titles instead of raw URLs.

## Decision
We will **automatically fetch webpage titles** for all URL values and display them as clickable links with the title as link text.

## Rationale

### User Experience
1. **Scannable content**: "How to Build Web Components" vs "https://developer.mozilla.org/..."
2. **Context at a glance**: Title indicates what the link is about
3. **Professional appearance**: Clean, organized look
4. **Memory aid**: Titles help users remember what they logged

### Automation
1. **Zero user effort**: Happens automatically in background
2. **Progressive enhancement**: URL shows immediately, title loads async
3. **Graceful degradation**: Falls back to URL if fetch fails

### Consistency
1. **Works everywhere**: Main value, custom properties, notes field
2. **Same format**: [[title::url]] pattern used throughout
3. **Predictable behavior**: Users learn it works for all URLs

## Architecture

### Flow

#### 1. URL Detection
When a URL is entered in:
- Entity/entry main value (if type is url/hyperlink/image/audio/video)
- Custom property value (if property type is url)
- Notes field (any http/https URL)

#### 2. Initial Save
- Entry saved immediately with URL
- User sees URL briefly as placeholder

#### 3. Async Title Fetch
```typescript
async fetchUrlMetadata(url: string) {
  // Try CORS proxies in order with timeout
  const proxies = [
    { name: 'corsproxy.io', url: `https://corsproxy.io/?${url}`, parseJson: false },
    { name: 'allorigins', url: `https://api.allorigins.win/get?url=${url}`, parseJson: true }
  ];

  for (const proxy of proxies) {
    try {
      // Fetch with 5-second timeout
      const response = await fetch(proxy.url, { signal: abortSignal });
      const html = proxy.parseJson ? data.contents : response.text();

      // Parse HTML to extract <title>
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const title = doc.querySelector('title')?.textContent;

      if (title && title.trim()) {
        return { title, url };
      }
    } catch {
      // Try next proxy
    }
  }

  // All proxies failed - fallback to hostname
  const hostname = new URL(url).hostname.replace('www.', '');
  return { title: hostname, url };
}
```

#### 4. Store Title
**For main value**:
- Updates `entry.valueDisplay` with fetched title
- Original URL remains in `entry.value`

**For properties**:
- Updates `entry.propertyValueDisplays[propertyId]` with title
- Original URL remains in `entry.propertyValues[propertyId]`

**For notes**:
- Replaces URL in text with `[[title::url]]` format
- Preserves both title and URL for rendering

#### 5. Display
```html
<!-- Main value or property -->
<a href="https://example.com" target="_blank">
  Fetched Page Title
</a>

<!-- Notes field -->
I read [[How to Build Web Components::https://developer.mozilla.org/...]]
<!-- Renders as: -->
I read <a href="https://developer.mozilla.org/...">How to Build Web Components</a>
```

### CORS Proxy Strategy

#### Why Needed
- Direct fetch from browser blocked by CORS
- Most websites don't set `Access-Control-Allow-Origin: *`
- Need intermediary to proxy requests

#### Proxy Selection
1. **Primary**: corsproxy.io
   - Fast, reliable
   - Returns raw HTML
   - Free tier sufficient

2. **Fallback**: allorigins.win
   - Returns JSON with contents
   - Slightly slower
   - Good backup option

3. **Final Fallback**: URL hostname
   - If all proxies fail/timeout
   - Example: `example.com` instead of full title
   - Always succeeds

#### Timeout Strategy
- 5 seconds per proxy
- AbortController to cancel hung requests
- Fail fast and try next proxy
- Total max time: ~10 seconds (2 proxies)

### Storage Format

#### Main Value
```typescript
{
  value: "https://example.com/article",
  valueDisplay: "Complete Guide to Web Components"
}
```

#### Property Value
```typescript
{
  propertyValues: {
    "prop-abc123": "https://github.com/user/repo"
  },
  propertyValueDisplays: {
    "prop-abc123": "user/repo: Amazing Project"
  }
}
```

#### Notes Field
```typescript
{
  notes: "Check out [[Web Components Guide::https://example.com/guide]] for more info"
}
```

### Display Components

#### EntryListComponent
```typescript
// Main value
formatValue(value, valueDisplay, valueType) {
  if (valueType === 'url' && valueDisplay) {
    return `<a href="${value}">${valueDisplay}</a>`;
  }
  return escapeHtml(value);
}

// Property values
formatPropertyValue(value, valueType, displayValue) {
  if (valueType === 'url' && displayValue) {
    return `<a href="${value}">${displayValue}</a>`;
  }
  return escapeHtml(value);
}

// Notes
formatNotes(notes) {
  // Convert [[title::url]] to <a href="url">title</a>
  return notes.replace(/\[\[(.+?)::(.+?)\]\]/g,
    '<a href="$2">$1</a>');
}
```

#### EntityGridComponent
```typescript
// Same as above but with truncation for compact display
formatPropertyValue(value, valueType, displayValue) {
  if (valueType === 'url') {
    const text = displayValue || value;
    const truncated = text.length > 25 ? text.substring(0, 25) + '...' : text;
    return `<a href="${value}">${truncated}</a>`;
  }
  return escapeHtml(value);
}
```

## Implementation Details

### When Titles Are Fetched

1. **Creating new entry**: After entry saved to store
2. **Editing entry**: After entry updated
3. **Only for new/changed URLs**: Doesn't re-fetch existing titles
4. **Async/non-blocking**: User can continue working while fetching

### Entry Form (EntryFormComponent)
```typescript
async handleSubmit(e) {
  // ... create entry ...

  this.store.addEntry(entry);

  // Fetch title for main value if URL
  if (value && typeof value === 'string' && this.isUrl(value)) {
    this.fetchAndUpdateTitle(entry.id, value);
  }

  // Fetch titles for URL-type properties
  if (entity.properties && entry.propertyValues) {
    this.fetchPropertyUrlTitles(entry.id, entity.properties, entry.propertyValues);
  }

  // Process URLs in notes
  if (notes && notes.trim()) {
    this.processTextWithUrls(entry.id, notes, 'notes');
  }

  // Close panel (user doesn't wait for fetches)
  URLStateManager.closePanel();
}
```

### Edit Form (EntryEditFormComponent)
Same pattern as EntryFormComponent - fetches titles after update.

## Consequences

### Positive
- **Better UX**: Readable titles instead of cryptic URLs
- **Zero effort**: Fully automatic, no user action needed
- **Works everywhere**: Main value, properties, notes
- **Graceful degradation**: Shows URL if fetch fails
- **Async/non-blocking**: Doesn't slow down form submission
- **Caching**: Fetched title stored permanently
- **Universal**: Works for any HTTP/HTTPS URL

### Negative
- **Privacy concern**: URLs sent to third-party CORS proxies
- **Reliability**: Depends on external services (proxies)
- **Latency**: Visible delay before title appears (2-10 seconds)
- **Accuracy**: Fetched title might not match user's expectation
- **Network dependency**: Requires internet connection
- **Storage cost**: Stores both URL and title (more localStorage usage)

### Trade-offs
- **Automation vs control**: User can't customize titles
- **Privacy vs features**: CORS proxy sees all URLs
- **Speed vs accuracy**: Could show hostname instantly but less useful

## Edge Cases

### 1. Fetch Fails
- All proxies timeout/error
- Falls back to hostname: `example.com`
- Better than showing full URL

### 2. Title is URL
- Some pages have URL as title
- Only updates if `title !== url`
- Prevents storing duplicate data

### 3. No Title Tag
- HTML parsing finds no `<title>`
- Falls back to hostname

### 4. Special Characters
- Title escaped with `escapeHtml()` to prevent XSS
- URL also escaped in href attribute

### 5. Very Long Titles
- **Entry list**: Full title shown
- **Entity grid**: Truncated to 25 chars + "..."
- Hover shows full URL in browser status bar

### 6. Multiple URLs in Notes
- All URLs fetched in parallel with `Promise.all()`
- Each replaced with [[title::url]] format
- Fast for multiple links

## Security Considerations

### XSS Prevention
1. All titles escaped with `escapeHtml()` before rendering
2. URLs escaped in href attributes
3. HTML parsing uses DOMParser (safe, sandboxed)

### Privacy
1. CORS proxies see all logged URLs
2. Users should be aware external services involved
3. Future: Option to disable title fetching
4. Future: Self-hosted CORS proxy option

### Validation
1. URL validation before fetch attempt
2. Only HTTP/HTTPS protocols accepted
3. Invalid URLs ignored silently

## Performance

### Optimization
- Fetch happens after panel closes (non-blocking)
- Multiple fetches run in parallel
- 5-second timeout prevents hanging
- No polling or retry logic (one attempt per proxy)

### Storage Impact
- Average title: ~50 characters
- Average URL: ~100 characters
- Total per URL: ~150 characters (~300 bytes)
- 1000 entries with URLs: ~300KB (acceptable for localStorage)

## Future Enhancements

### Short-term
1. **Manual title edit**: Allow user to customize fetched title
2. **Re-fetch button**: Refresh title if page updated
3. **Disable option**: Setting to turn off auto-fetching
4. **Loading indicator**: Show fetching state

### Long-term
1. **Self-hosted proxy**: Avoid third-party dependencies
2. **Cache titles**: Store common domains (wikipedia.org → Wikipedia)
3. **Favicon display**: Show site icon alongside title
4. **URL preview**: Hover card with page preview/screenshot
5. **Link validation**: Check if URL is still live (404 detection)
6. **Archive URLs**: Save page content/snapshot

## Related Decisions
- [ADR-0009: Custom Entity Properties](0009-custom-entity-properties.md) - Properties support URL type
- Reuses value type infrastructure for consistency

## Migration
- Existing entries: No valueDisplay/propertyValueDisplays
- Display code checks if display value exists before using
- Gracefully falls back to showing URL
- No data migration needed
- Feature is purely additive
