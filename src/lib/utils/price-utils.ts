/**
 * Rounds a price to 2 decimal places.
 * Returns undefined if price is invalid or null.
 */
export function normalisePrice(price: number | undefined | null): number | undefined {
    if (price == null || isNaN(price) || price < 0) {
        return undefined;
    }
    return Math.round(price * 100) / 100;
}

/**
 * Normalises price range to 2 decimals.
 * Ensures priceMin <= priceMax.
 */
export function normalisePriceRange(
    priceMin: number | undefined | null,
    priceMax: number | undefined | null
): { priceMin?: number; priceMax?: number } {
    const min = normalisePrice(priceMin);
    const max = normalisePrice(priceMax);

    // If both exist, ensure min <= max
    if (min != null && max != null && min > max) {
        return { priceMin: max, priceMax: min };
    }

    return { priceMin: min, priceMax: max };
}