/**
 * Spotify Integration Service
 * 
 * Fetches artist popularity data from Spotify to enhance event popularity scoring.
 * Uses Spotify's public API with client credentials flow (no user auth required).
 */

interface SpotifyArtist {
    id: string;
    name: string;
    popularity: number; // 0-100
    followers: {
        total: number;
    };
}

interface SpotifySearchResponse {
    artists?: {
        items: SpotifyArtist[];
    };
}

/**
 * Get Spotify access token using client credentials flow.
 * Token is valid for 1 hour.
 */
async function getSpotifyAccessToken(): Promise<string | null> {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.warn('[Spotify] Missing credentials - skipping');
        return null;
    }

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            },
            body: 'grant_type=client_credentials',
        });

        if (!response.ok) {
            console.error('[Spotify] Auth failed:', response.status);
            return null;
        }

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('[Spotify] Auth error:', error);
        return null;
    }
}

/**
 * Search for an artist on Spotify and return their popularity data.
 * Returns null if artist not found or API fails.
 */
export async function searchSpotifyArtist(artistName: string): Promise<SpotifyArtist | null> {
    const token = await getSpotifyAccessToken();
    if (!token) return null;

    try {
        // Clean artist name for better search results
        const cleanName = artistName
            .replace(/\(.*?\)/g, '') // Remove parentheses
            .replace(/\s+(live|tour|concert|show|tribute)$/i, '') // Remove common suffixes
            .trim();

        const response = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(cleanName)}&type=artist&limit=1`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            }
        );

        if (!response.ok) {
            console.error('[Spotify] Search failed:', response.status);
            return null;
        }

        const data: SpotifySearchResponse = await response.json();
        const artist = data.artists?.items[0];

        if (!artist) {
            return null;
        }

        // Verify name similarity to avoid false matches
        const similarity = calculateNameSimilarity(cleanName.toLowerCase(), artist.name.toLowerCase());
        if (similarity < 0.6) {
            console.log(`[Spotify] Name mismatch: "${cleanName}" vs "${artist.name}" (${similarity.toFixed(2)})`);
            return null;
        }

        return artist;
    } catch (error) {
        console.error('[Spotify] Search error:', error);
        return null;
    }
}

/**
 * Simple string similarity check using Dice coefficient.
 * Returns value between 0 (no match) and 1 (perfect match).
 */
function calculateNameSimilarity(str1: string, str2: string): number {
    const bigrams1 = getBigrams(str1);
    const bigrams2 = getBigrams(str2);

    const intersection = bigrams1.filter(b => bigrams2.includes(b)).length;
    return (2 * intersection) / (bigrams1.length + bigrams2.length);
}

/**
 * Get character bigrams from a string for similarity comparison.
 */
function getBigrams(str: string): string[] {
    const bigrams: string[] = [];
    for (let i = 0; i < str.length - 1; i++) {
        bigrams.push(str.substring(i, i + 2));
    }
    return bigrams;
}

/**
 * Extract artist name from event title.
 * Handles common patterns like "Artist Name: Event Title" or "Event by Artist Name".
 */
export function extractArtistName(eventTitle: string): string | null {
    // Pattern 1: "Artist: Title" or "Artist - Title"
    const colonMatch = eventTitle.match(/^([^:—–-]+)[:—–-]/);
    if (colonMatch) {
        return colonMatch[1].trim();
    }

    // Pattern 2: "Title by Artist" or "Title featuring Artist"
    const byMatch = eventTitle.match(/(?:by|featuring|feat\.?|ft\.?)\s+(.+)$/i);
    if (byMatch) {
        return byMatch[1].trim();
    }

    // Pattern 3: Just use the full title (may or may not be an artist name)
    return eventTitle.trim();
}

/**
 * Calculate Spotify popularity contribution to event score.
 * Normalises Spotify's 0-100 scale to match our scoring weights.
 */
export function calculateSpotifyScore(popularity: number): number {
    // Spotify popularity is 0-100, we scale it appropriately
    return popularity * 0.5; // Max contribution of 50 points
}