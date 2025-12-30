export const resolveApiUrl = (url: string | undefined | null): string => {
    if (!url) return '';

    // If it's already a full URL that starts with http:// or https://
    // We check for both https:// and https:/ (common malformation)
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('http:/') || url.startsWith('https:/')) {
        // Fix common malformation if it has only one slash after the protocol
        let fixedUrl = url;
        if (url.startsWith('https:/') && !url.startsWith('https://')) {
            fixedUrl = url.replace('https:/', 'https://');
        } else if (url.startsWith('http:/') && !url.startsWith('http://')) {
            fixedUrl = url.replace('http:/', 'http://');
        }
        return fixedUrl;
    }

    // Otherwise, it's a relative path. Prepend the API base URL.
    // NEXT_PUBLIC_API_URL usually points to http://domain:port/api
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

    // Clean up slashes to avoid domain/api//path or domain/apipath
    const cleanBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    const cleanPath = url.startsWith('/') ? url : `/${url}`;

    // Special case: if base is just "/api" (relative proxy), 
    // we want to ensure we don't return something like "/api/https://..."
    return `${cleanBase}${cleanPath}`;
};
