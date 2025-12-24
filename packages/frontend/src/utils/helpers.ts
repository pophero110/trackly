/**
 * Helper utility functions
 */

export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function formatDate(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
        return 'Today, ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } else if (days === 1) {
        return 'Yesterday, ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } else if (days < 7) {
        return `${days} days ago`;
    } else {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
}

export function getCurrentTimestamp(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 19);
}

// Cache for URL titles to reduce repeated fetches
const titleCache = new Map<string, string>();

// Load cache from localStorage on startup
try {
    const cachedTitles = localStorage.getItem('url_title_cache');
    if (cachedTitles) {
        const parsed = JSON.parse(cachedTitles);
        Object.entries(parsed).forEach(([url, title]) => {
            titleCache.set(url, title as string);
        });
    }
} catch {
    // Ignore cache load errors
}

/**
 * Fetch the title of a webpage from its URL
 * Tries multiple CORS proxies with timeout, falls back to hostname
 * Caches results to avoid repeated fetches
 */
export async function fetchPageTitle(url: string): Promise<string> {
    // Check cache first
    if (titleCache.has(url)) {
        return titleCache.get(url)!;
    }

    const proxies = [
        { name: 'corsproxy.io', url: `https://corsproxy.io/?${encodeURIComponent(url)}`, parseJson: false },
        { name: 'allorigins', url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, parseJson: true }
    ];

    // Try each proxy with a timeout
    for (const proxy of proxies) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const response = await fetch(proxy.url, { signal: controller.signal });
            clearTimeout(timeoutId);

            // Check if response is successful (403, 429, etc. will fail here)
            if (!response.ok) {
                continue; // Skip to next proxy silently
            }

            let html: string;
            if (proxy.parseJson) {
                const data = await response.json();
                html = data.contents;
            } else {
                html = await response.text();
            }

            if (html) {
                // Parse the HTML to extract the title
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const title = doc.querySelector('title')?.textContent;

                if (title && title.trim()) {
                    const trimmedTitle = title.trim();
                    // Cache the successful result
                    titleCache.set(url, trimmedTitle);
                    saveTitleCache();
                    return trimmedTitle;
                }
            }
        } catch (error) {
            // Try next proxy silently (network errors, timeouts, etc.)
            continue;
        }
    }

    // All proxies failed, fallback to hostname
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace('www.', '');
        // Cache the fallback result to avoid repeated failures
        titleCache.set(url, hostname);
        saveTitleCache();
        return hostname;
    } catch {
        // Cache the URL itself as last resort
        titleCache.set(url, url);
        saveTitleCache();
        return url;
    }
}

/**
 * Save title cache to localStorage
 */
function saveTitleCache(): void {
    try {
        const cacheObj = Object.fromEntries(titleCache.entries());
        localStorage.setItem('url_title_cache', JSON.stringify(cacheObj));
    } catch {
        // Ignore save errors
    }
}

/**
 * Extract title from URL using CORS proxy
 * Fetches the actual page title from the HTML
 */
export async function fetchUrlMetadata(url: string): Promise<{ title: string; url: string }> {
    try {
        const title = await fetchPageTitle(url);
        return {
            title: title,
            url: url
        };
    } catch (error) {
        // Fallback to URL
        return {
            title: url,
            url: url
        };
    }
}

/**
 * Extract all URLs from a text string that are NOT already in markdown links
 */
export function extractUrls(text: string): string[] {
    // First, remove all markdown links to avoid matching URLs inside them
    const textWithoutMarkdownLinks = text.replace(/\[([^\]]+?)\]\((.+?)\)/g, '');

    // Now extract URLs from the remaining text
    // Match both http(s):// URLs and www. URLs
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    const matches = textWithoutMarkdownLinks.match(urlRegex);

    // Normalize www. URLs to include https://
    if (matches) {
        return matches.map(url => {
            if (url.startsWith('www.')) {
                return 'https://' + url;
            }
            return url;
        });
    }

    return [];
}

/**
 * Replace URLs in text with their fetched titles
 * Returns both the processed text and a map of URL -> title
 * Format: [title](url) - markdown link format
 */
export async function replaceUrlsWithTitles(text: string): Promise<{ text: string; urlMap: Map<string, string> }> {
    const urls = extractUrls(text);
    const urlMap = new Map<string, string>();

    if (urls.length === 0) {
        return { text, urlMap };
    }

    // Get unique URLs to avoid duplicate fetches
    const uniqueUrls = Array.from(new Set(urls));

    // Fetch all titles in parallel
    const titlePromises = uniqueUrls.map(url => fetchUrlMetadata(url));
    const results = await Promise.all(titlePromises);

    // Create URL to title mapping
    const urlToTitle = new Map<string, string>();
    results.forEach((result, index) => {
        const url = uniqueUrls[index];
        urlToTitle.set(url, result.title);
        urlMap.set(url, result.title);
    });

    // Replace URLs with placeholders first to avoid nested replacements
    const placeholders = new Map<string, string>();
    let processedText = text;

    // First pass: Replace all www. URLs with unique placeholders
    // This is done separately to avoid conflicts with the normalized https:// versions
    const wwwUrlsInText: Array<{original: string, normalized: string, index: number}> = [];
    uniqueUrls.forEach((url, index) => {
        if (url.startsWith('https://www.')) {
            const wwwVersion = url.substring(8); // Remove 'https://'
            // Check if the original text contains the www. version (not already in https:// form)
            // We need to check if www. appears as standalone text, not just inside markdown links
            const wwwPattern = new RegExp(`(?<!\\]\\()${wwwVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\))`, 'g');
            if (wwwPattern.test(text)) {
                wwwUrlsInText.push({original: wwwVersion, normalized: url, index});
            }
        }
    });

    // Replace www. versions with placeholders
    wwwUrlsInText.forEach(({original, normalized, index}) => {
        const placeholder = `___URL_PLACEHOLDER_${index}___`;
        const title = urlToTitle.get(normalized) || normalized;
        placeholders.set(placeholder, `[${title}](${normalized})`);

        // Use regex to replace only standalone URLs (not inside markdown links)
        // Check that the URL is not preceded by ]( which would indicate it's already in a markdown link
        const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<!\\]\\()${escapedOriginal}(?!\\))`, 'g');
        processedText = processedText.replace(regex, placeholder);
    });

    // Replace http(s):// URLs with placeholders
    uniqueUrls.forEach((url, index) => {
        // Skip if already processed as www URL
        if (wwwUrlsInText.some(item => item.index === index)) {
            return;
        }

        const placeholder = `___URL_PLACEHOLDER_${index}___`;
        const title = urlToTitle.get(url) || url;
        placeholders.set(placeholder, `[${title}](${url})`);

        // Use regex to replace only standalone URLs (not inside markdown links)
        // Check that the URL is not preceded by ]( which would indicate it's already in a markdown link
        const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<!\\]\\()${escapedUrl}(?!\\))`, 'g');
        processedText = processedText.replace(regex, placeholder);
    });

    // Replace all placeholders with markdown links
    placeholders.forEach((markdown, placeholder) => {
        processedText = processedText.replace(placeholder, markdown);
    });

    return { text: processedText, urlMap };
}
