import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked for GitHub Flavored Markdown
marked.setOptions({
    gfm: true,
    breaks: true
});

/**
 * Ensure first line has h1 heading marker
 * Returns notes with first line converted to h1 heading
 * - If no heading: add "# "
 * - If h2-h6 heading: convert to h1 by replacing with "# "
 */
export function ensureH1Heading(notes: string): string {
    if (!notes || notes.trim() === '') return notes;

    const lines = notes.split('\n');
    if (lines.length > 0 && lines[0].trim() !== '') {
        const firstLine = lines[0].trim();

        // Check if first line has any heading marker (# - ######)
        const headingMatch = firstLine.match(/^(#{1,6})\s+(.*)$/);

        if (headingMatch) {
            // Has a heading - check if it's not h1
            if (headingMatch[1] !== '#') {
                // Convert to h1
                lines[0] = '# ' + headingMatch[2];
                return lines.join('\n');
            }
            // Already h1, no change needed
            return notes;
        } else {
            // No heading - add h1
            lines[0] = '# ' + firstLine;
            return lines.join('\n');
        }
    }

    return notes;
}

/**
 * Parse markdown text to sanitized HTML
 * Supports GitHub Flavored Markdown with hashtag links
 */
export function parseMarkdown(text: string): string {
    if (!text || text.trim() === '') return '';

    // Step 1: Parse markdown
    let html = marked.parse(text, { async: false }) as string;

    // Step 2: Add custom classes and attributes to links
    // Make all links open in new tab with proper styling
    html = html.replace(
        /<a href="([^"]+)">/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">'
    );

    // Step 3: Add custom classes to lists
    html = html.replace(/<ul>/g, '<ul class="markdown-list">');
    html = html.replace(/<ol>/g, '<ol class="markdown-list">');
    html = html.replace(/<li>/g, '<li class="markdown-list-item">');

    // Step 4: Add hashtag links (post-process)
    // Match hashtags that are not inside href attributes or URLs
    html = html.replace(
        /(?<!href=["'][^"']*|:\/\/[^\s]*)(^|\s|>)#([a-zA-Z0-9_]+)/g,
        (_match, prefix, tag) => {
            return `${prefix}<a href="#" class="hashtag" data-tag="${tag}" style="color: var(--primary); text-decoration: none; font-weight: 500;">#${tag}</a>`;
        }
    );

    // Step 5: Sanitize with DOMPurify
    html = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['a', 'p', 'br', 'strong', 'em', 'b', 'i', 'code', 'pre', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
        ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class', 'data-tag', 'style', 'start']
    });

    return html;
}
