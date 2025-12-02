import { CATEGORIES } from '@/lib/constants/categories';
import { Event } from '@/lib/models';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface PriceDistribution {
    category: string;
    displayName: string;
    count: number;
    min: number;
    max: number;
    avgPrice: number;
    median: number;
    q1: number;
    q3: number;
    isSubcategory: boolean;
}

export interface TimelineData {
    month: string;
    monthDate: Date;
    total: number;
    [category: string]: number | string | Date;
}

export interface PopularityData {
    title: string;
    category: string;
    priceMin: number;
    priceMax?: number;
    popularity: number;
    favourites: number;
}

// ============================================
// PRIVATE HELPERS
// ============================================

function buildCategoryFilter(selectedCategories?: string[]) {
    if (!selectedCategories?.length) return {};

    const mainCategories: string[] = [];
    const subcategories: string[] = [];

    selectedCategories.forEach(cat => {
        const isSubcategory = CATEGORIES.some(mainCat =>
            mainCat.subcategories?.includes(cat)
        );
        (isSubcategory ? subcategories : mainCategories).push(cat);
    });

    const conditions: any[] = [];
    if (mainCategories.length) conditions.push({ category: { $in: mainCategories } });
    if (subcategories.length) conditions.push({ subcategories: { $in: subcategories } });

    return conditions.length ? { $or: conditions } : {};
}

function matchesCategories(event: any, selectedCategories?: string[]): boolean {
    if (!selectedCategories?.length) return true;
    if (selectedCategories.includes(event.category)) return true;

    if (Array.isArray(event.subcategories)) {
        return event.subcategories.some((sub: string) => selectedCategories.includes(sub));
    }

    return false;
}

function calculatePriceStats(prices: number[]) {
    const sorted = [...prices].sort((a, b) => a - b);
    const count = sorted.length;

    return {
        count,
        min: Math.round(sorted[0]),
        max: Math.round(sorted[count - 1]),
        avgPrice: Math.round(prices.reduce((sum, p) => sum + p, 0) / count),
        median: Math.round(sorted[Math.floor(count / 2)]),
        q1: Math.round(sorted[Math.floor(count * 0.25)]),
        q3: Math.round(sorted[Math.floor(count * 0.75)]),
    };
}

// ============================================
// PUBLIC API
// ============================================

export async function computePriceDistribution(
    selectedCategories?: string[]
): Promise<PriceDistribution[]> {
    const now = new Date();
    const categoryFilter = buildCategoryFilter(selectedCategories);

    const events = await Event.find({
        startDate: { $gte: now },
        isFree: false,
        priceMin: { $exists: true, $gt: 0 },
        ...categoryFilter,
    })
        .select('category subcategories priceMin priceMax')
        .lean();

    if (!events.length) return [];

    const groups: Record<string, number[]> = {};

    events.forEach(event => {
        const addPrices = (categoryName: string) => {
            groups[categoryName] ??= [];

            if (event.priceMin) {
                groups[categoryName].push(event.priceMin);
            }

            if (event.priceMax && event.priceMax > (event.priceMin || 0)) {
                groups[categoryName].push(event.priceMax);
            }
        };

        if (selectedCategories?.length) {
            const selectedSubs = event.subcategories?.filter(sub =>
                selectedCategories.includes(sub)
            ) || [];

            selectedSubs.forEach(addPrices);

            if (selectedCategories.includes(event.category) && !selectedSubs.length) {
                addPrices(event.category);
            }
        } else {
            addPrices(event.category);
        }
    });

    const result: PriceDistribution[] = [];

    for (const [categoryName, prices] of Object.entries(groups)) {
        if (!prices.length) continue;

        const isSubcategory = CATEGORIES.some(cat =>
            cat.subcategories?.includes(categoryName)
        );

        result.push({
            category: categoryName,
            displayName: categoryName.charAt(0).toUpperCase() + categoryName.slice(1),
            isSubcategory,
            ...calculatePriceStats(prices),
        });
    }

    return result.sort((a, b) => b.count - a.count);
}

export async function computeTimeline(
    selectedCategories?: string[]
): Promise<TimelineData[]> {
    const now = new Date();
    const sixMonthsLater = new Date(now);
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

    const categoryFilter = buildCategoryFilter(selectedCategories);

    const events = await Event.find({
        startDate: { $gte: now, $lte: sixMonthsLater },
        ...categoryFilter,
    })
        .select('startDate category')
        .lean();

    const monthGroups: Record<string, { date: Date; categories: Record<string, number> }> = {};

    events.forEach(event => {
        const year = event.startDate.getFullYear();
        const month = event.startDate.getMonth();
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

        if (!monthGroups[monthKey]) {
            monthGroups[monthKey] = {
                date: new Date(year, month, 1),
                categories: {}
            };
        }

        const categoryKey = event.category;
        monthGroups[monthKey].categories[categoryKey] =
            (monthGroups[monthKey].categories[categoryKey] || 0) + 1;
    });

    const result: TimelineData[] = Object.entries(monthGroups)
        .map(([key, data]) => ({
            month: data.date.toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
            }),
            monthDate: data.date,
            total: Object.values(data.categories).reduce((sum, count) => sum + count, 0),
            ...data.categories,
        }))
        .sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime());

    return result;
}

export async function computePopularityData(
    selectedCategories?: string[]
): Promise<PopularityData[]> {
    const now = new Date();
    const categoryFilter = buildCategoryFilter(selectedCategories);

    const events = await Event.find({
        startDate: { $gte: now },
        priceMin: { $exists: true, $gt: 0 },
        'stats.categoryPopularityPercentile': { $exists: true },
        ...categoryFilter,
    })
        .select('title category subcategories priceMin priceMax stats.categoryPopularityPercentile stats.favouriteCount')
        .limit(500)
        .lean();

    const filteredEvents = selectedCategories?.length
        ? events.filter(event => matchesCategories(event, selectedCategories))
        : events;

    return filteredEvents.map(event => ({
        title: event.title,
        category: event.category,
        priceMin: event.priceMin || 0,
        priceMax: event.priceMax,
        popularity: event.stats?.categoryPopularityPercentile || 0,
        favourites: event.stats?.favouriteCount || 0,
    }));
}