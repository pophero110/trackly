/**
 * Extract hashtags from text (mirrors frontend logic)
 */
export function extractHashtags(text: string): string[] {
  if (!text) return [];

  // Remove markdown links to avoid matching hashtags in URLs
  const textWithoutLinks = text.replace(/\[([^\]]+?)\]\((.+?)\)/g, '');

  const hashtagRegex = /(?<![a-zA-Z0-9_])#([a-zA-Z0-9_]+)(?![a-zA-Z0-9_])/g;
  const hashtags: string[] = [];
  let match;

  while ((match = hashtagRegex.exec(textWithoutLinks)) !== null) {
    if (!hashtags.includes(match[1].toLowerCase())) {
      hashtags.push(match[1].toLowerCase());
    }
  }

  return hashtags;
}
