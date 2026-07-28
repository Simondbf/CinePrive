export async function apiGet<T>(url: string, fallback: T): Promise<T> {
    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`[API] Error fetching ${url}: ${res.statusText}`);
            return fallback;
        }
        return await res.json();
    } catch (e) {
        console.error(`[API] Network or parsing error fetching ${url}:`, e);
        return fallback;
    }
}
