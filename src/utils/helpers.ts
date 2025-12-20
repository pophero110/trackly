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

/**
 * Fetch the title of a webpage from its URL
 * Tries multiple CORS proxies with timeout, falls back to hostname
 */
export async function fetchPageTitle(url: string): Promise<string> {
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
                    return title.trim();
                }
            }
        } catch (error) {
            // Try next proxy
            continue;
        }
    }

    // All proxies failed, fallback to hostname
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace('www.', '');
        return hostname;
    } catch {
        return url;
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
 * Extract all URLs from a text string
 */
export function extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches || [];
}

/**
 * Replace URLs in text with their fetched titles
 * Returns both the processed text and a map of URL -> title
 * Format: [[title::url]] to preserve both title and URL
 */
export async function replaceUrlsWithTitles(text: string): Promise<{ text: string; urlMap: Map<string, string> }> {
    const urls = extractUrls(text);
    const urlMap = new Map<string, string>();

    if (urls.length === 0) {
        return { text, urlMap };
    }

    // Fetch all titles in parallel
    const titlePromises = urls.map(url => fetchUrlMetadata(url));
    const results = await Promise.all(titlePromises);

    let processedText = text;
    results.forEach((result, index) => {
        const url = urls[index];
        urlMap.set(url, result.title);
        // Replace URL with format [[title::url]] to preserve both
        const replacement = `[[${result.title}::${url}]]`;
        // Use split/join to replace all occurrences safely without regex issues
        processedText = processedText.split(url).join(replacement);
    });

    return { text: processedText, urlMap };
}
