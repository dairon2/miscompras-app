export const resolveApiUrl = (url: string | undefined | null): string => {
    if (!url) return '';

    const appendFileToken = (targetUrl: string): string => {
        if (typeof window === 'undefined') return targetUrl;
        const token = localStorage.getItem('token');
        if (!token) return targetUrl;

        try {
            const parsedUrl = new URL(targetUrl, window.location.origin);
            if (parsedUrl.pathname.startsWith('/api/uploads') || parsedUrl.pathname.startsWith('/api/exports')) {
                parsedUrl.searchParams.set('token', token);
                return parsedUrl.toString();
            }
        } catch {
            // Fall through and return the original URL.
        }

        return targetUrl;
    };

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
        return appendFileToken(fixedUrl);
    }

    // Otherwise, it's a relative path. Prepend the API base URL.
    // NEXT_PUBLIC_API_URL usually points to http://domain:port/api
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

    // Clean up slashes to avoid domain/api//path or domain/apipath
    const cleanBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    const cleanPath = url.startsWith('/') ? url : `/${url}`;

    // Special case: if base is just "/api" (relative proxy), 
    // we want to ensure we don't return something like "/api/https://..."
    return appendFileToken(`${cleanBase}${cleanPath}`);
};
