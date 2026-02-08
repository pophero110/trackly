import { escapeHtml } from '../../../core/utils/helpers.js';

/**
 * Get consistent color for tag based on name
 */
export function getTagColor(tagName: string): string {
  const colorMap: Record<string, string> = {
    'Life': '#10b981',
    'Work': '#3b82f6',
    'Travel': '#8b5cf6',
    'Health': '#ef4444',
    'Finance': '#f59e0b',
    'Learning': '#06b6d4',
    'Fitness': '#ec4899',
    'Food': '#f97316',
    'Reading': '#6366f1',
    'Project': '#14b8a6',
  };

  if (colorMap[tagName]) {
    return colorMap[tagName];
  }

  // Generate consistent color based on tag name hash
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash % 360);
  const saturation = 65 + (Math.abs(hash) % 20);
  const lightness = 50 + (Math.abs(hash >> 8) % 15);

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Extract URLs from markdown links in text
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const urls: string[] = [];
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    urls.push(match[2]);
  }

  return urls;
}

/**
 * Extract markdown links with titles from text
 */
export function extractMarkdownLinks(text: string): Array<{title: string, url: string}> {
  const links: Array<{title: string, url: string}> = [];
  const markdownRegex = /\[([^\]]+?)\]\((.+?)\)/g;
  let match;

  while ((match = markdownRegex.exec(text)) !== null) {
    links.push({ title: match[1], url: match[2] });
  }

  return links;
}

/**
 * Extract unique hashtags from text
 */
export function extractHashtags(text: string): string[] {
  // Remove markdown links first to avoid matching hashtags in URLs
  const textWithoutLinks = text.replace(/\[([^\]]+?)\]\((.+?)\)/g, '');

  const hashtagRegex = /(?<![a-zA-Z0-9_])#([a-zA-Z0-9_]+)(?![a-zA-Z0-9_])/g;
  const hashtags: string[] = [];
  let match;

  while ((match = hashtagRegex.exec(textWithoutLinks)) !== null) {
    // Avoid duplicates
    if (!hashtags.includes(match[1])) {
      hashtags.push(match[1]);
    }
  }

  return hashtags;
}

/**
 * Render references section with URLs and hashtags
 */
export function renderReferences(notes: string, options: {
  includeHashtags?: boolean;
  urlDisplayLength?: number;
} = {}): string {
  const { includeHashtags = true, urlDisplayLength = 50 } = options;

  const urls = extractUrls(notes);
  const hashtags = includeHashtags ? extractHashtags(notes) : [];

  if (urls.length === 0 && hashtags.length === 0) return '';

  const urlsHtml = urls.map(url => {
    const displayUrl = url.length > urlDisplayLength ? url.substring(0, urlDisplayLength - 3) + '...' : url;
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="reference-link">${escapeHtml(displayUrl)}</a>`;
  }).join('');

  const hashtagsHtml = hashtags.map(tag => {
    return `<a href="#" class="hashtag-link reference-link" data-hashtag="${escapeHtml(tag)}">#${escapeHtml(tag)}</a>`;
  }).join('');

  const allReferences = [urlsHtml, hashtagsHtml].filter(html => html).join('');

  return `
    <div class="entry-references">
      <div class="references-links">${allReferences}</div>
    </div>
  `;
}

/**
 * Render tags section for entry list (shows only hashtags, not URLs)
 */
export function renderReferencesForList(notes: string): string {
  const hashtags = extractHashtags(notes);

  if (hashtags.length === 0) return '';

  const hashtagsHtml = hashtags.map(tag => {
    return `<a href="#" class="hashtag-link reference-link" data-hashtag="${escapeHtml(tag)}">#${escapeHtml(tag)}</a>`;
  }).join('');

  return hashtagsHtml;
}
