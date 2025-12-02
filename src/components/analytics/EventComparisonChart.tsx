'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Loader2, TrendingUp, DollarSign, BarChart3, Info } from 'lucide-react';
import Link from 'next/link';
import { ChartWrapper } from './ChartWrapper';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/Tooltip';

interface EventComparisonData {
    eventStats: {
        price: number;
        priceMax?: number;
        popularity: number;
        views: number;
    };
    categoryStats: {
        avgPrice: number;
        medianPrice: number;
        minPrice: number;
        maxPrice: number;
        totalEvents: number;
        avgPopularity: number;
    };
    percentiles: {
        pricePercentile: number;
        priceMaxPercentile?: number;
        popularityPercentile: number;
    };
    similarEvents: Array<{
        _id: string;
        title: string;
        price: number;
        priceMax?: number;
        popularity: number;
    }>;
}

interface EventComparisonProps {
    eventId: string;
    category: string;
    isFree?: boolean;
    priceMin?: number;
    priceMax?: number;
}

export function EventComparison({ eventId, category, isFree, priceMin, priceMax }: EventComparisonProps) {
    const [data, setData] = useState<EventComparisonData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredElement, setHoveredElement] = useState<'min' | 'max' | 'range' | null>(null);

    useEffect(() => {
        if (eventId && !isFree) {
            fetchComparisonData();
        }
    }, [eventId, isFree]);

    const fetchComparisonData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/events/comparison?eventId=${eventId}`);

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || 'Failed to load comparison data');
            }

            const result = await res.json();
            setData(result.data);
        } catch (err) {
            console.error('[EventComparison] Error:', err);
            setError(err instanceof Error ? err.message : 'Unable to load comparison data');
        } finally {
            setIsLoading(false);
        }
    };

    if (isFree) {
        return null;
    }

    if (isLoading) {
        return (
            <ChartWrapper
                icon={BarChart3}
                title="Event Analytics"
                description={`Compared to ${category} events in Melbourne`}
            >
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </ChartWrapper>
        );
    }

    if (error || !data) {
        return null;
    }

    const getPercentileColour = (percentile: number): string => {
        if (percentile >= 75) return 'text-emerald-600 dark:text-emerald-400';
        if (percentile >= 50) return 'text-teal-600 dark:text-teal-400';
        if (percentile >= 25) return 'text-orange-600 dark:text-orange-400';
        return 'text-rose-600 dark:text-rose-400';
    };

    const getPercentileLabel = (percentile: number): string => {
        if (percentile >= 75) return 'Top 25%';
        if (percentile >= 50) return 'Above Average';
        if (percentile >= 25) return 'Below Average';
        return 'Bottom 25%';
    };

    const getPriceComparison = (): string => {
        const { price } = data.eventStats;
        const { avgPrice, medianPrice } = data.categoryStats;

        if (price < medianPrice * 0.8) return 'Great value';
        if (price < avgPrice) return 'Good value';
        if (price > avgPrice * 1.2) return 'Premium pricing';
        return 'Average pricing';
    };

    const hasPriceRange = data.eventStats.priceMax && data.eventStats.priceMax > data.eventStats.price;

    // Calculate positions based on full category range
    const categoryRange = data.categoryStats.maxPrice - data.categoryStats.minPrice;
    const priceMinPosition = ((data.eventStats.price - data.categoryStats.minPrice) / categoryRange) * 100;
    const priceMaxPosition = hasPriceRange
        ? ((data.eventStats.priceMax! - data.categoryStats.minPrice) / categoryRange) * 100
        : priceMinPosition;
    const medianPosition = ((data.categoryStats.medianPrice - data.categoryStats.minPrice) / categoryRange) * 100;

    // Value zone: bottom 33% of price range
    const valueZoneThreshold = data.categoryStats.minPrice + (categoryRange * 0.33);

    return (
        <ChartWrapper
            icon={BarChart3}
            title="How This Event Compares"
            description={`Compared to ${data.categoryStats.totalEvents.toLocaleString()} other ${category} events`}
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium">Price Positioning</span>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button className="text-muted-foreground hover:text-foreground transition-colors">
                                                <Info className="h-3.5 w-3.5" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                            <p className="text-xs">
                                                This chart shows the full price range for all {category} events
                                                (${data.categoryStats.minPrice} - ${data.categoryStats.maxPrice}).
                                                {hasPriceRange
                                                    ? ` This event ranges from $${data.eventStats.price} to $${data.eventStats.priceMax}.`
                                                    : ` This event is priced at $${data.eventStats.price}.`}
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <Badge variant="outline" className="bg-muted/50">
                                {getPriceComparison()}
                            </Badge>
                        </div>

                        <div className="relative h-14 bg-muted rounded-lg overflow-hidden mb-3">
                            {/* Value zone: bottom third of price range */}
                            <div
                                className="absolute inset-y-0 left-0 bg-linear-to-r from-emerald-500/20 to-emerald-500/5 pointer-events-none"
                                style={{
                                    width: `${(valueZoneThreshold - data.categoryStats.minPrice) / categoryRange * 100}%`
                                }}
                            />

                            {/* Median line */}
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className="absolute inset-y-0 w-0.5 bg-border z-10 cursor-help hover:bg-foreground/40 transition-colors"
                                            style={{ left: `${medianPosition}%` }}
                                        >
                                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground whitespace-nowrap">
                                                Median
                                            </div>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-xs font-medium">Category Median: ${data.categoryStats.medianPrice}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            {hasPriceRange ? (
                                <>
                                    <TooltipProvider>
                                        <Tooltip open={hoveredElement === 'range'}>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className="absolute inset-y-0 bg-linear-to-r from-primary/40 to-primary/40 transition-all duration-500 cursor-pointer hover:from-primary/50 hover:to-primary/50 z-20"
                                                    style={{
                                                        left: `${priceMinPosition}%`,
                                                        width: `${priceMaxPosition - priceMinPosition}%`,
                                                    }}
                                                    onMouseEnter={() => setHoveredElement('range')}
                                                    onMouseLeave={() => setHoveredElement(null)}
                                                />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p className="text-xs font-medium">
                                                    This Event Range: ${data.eventStats.price} - ${data.eventStats.priceMax}
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                        <Tooltip open={hoveredElement === 'min'}>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className="absolute inset-y-0 w-1.5 bg-primary rounded-l-full transition-all duration-500 z-30 cursor-pointer hover:w-2 hover:shadow-lg"
                                                    style={{
                                                        left: `${priceMinPosition}%`,
                                                        transform: 'translateX(-50%)',
                                                    }}
                                                    onMouseEnter={() => setHoveredElement('min')}
                                                    onMouseLeave={() => setHoveredElement(null)}
                                                >
                                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap bg-background px-2 py-1 rounded border shadow-sm">
                                                        ${data.eventStats.price}
                                                    </div>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p className="text-xs font-medium">Minimum Price: ${data.eventStats.price}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                        <Tooltip open={hoveredElement === 'max'}>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className="absolute inset-y-0 w-1.5 bg-primary rounded-r-full transition-all duration-500 z-30 cursor-pointer hover:w-2 hover:shadow-lg"
                                                    style={{
                                                        left: `${priceMaxPosition}%`,
                                                        transform: 'translateX(-50%)',
                                                    }}
                                                    onMouseEnter={() => setHoveredElement('max')}
                                                    onMouseLeave={() => setHoveredElement(null)}
                                                >
                                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap bg-background px-2 py-1 rounded border shadow-sm">
                                                        ${data.eventStats.priceMax}
                                                    </div>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p className="text-xs font-medium">Maximum Price: ${data.eventStats.priceMax}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </>
                            ) : (
                                <TooltipProvider>
                                    <Tooltip open={hoveredElement === 'min'}>
                                        <TooltipTrigger asChild>
                                            <div
                                                className="absolute inset-y-0 w-1.5 bg-primary rounded-full transition-all duration-500 z-20 shadow-lg cursor-pointer hover:w-2"
                                                style={{
                                                    left: `${priceMinPosition}%`,
                                                    transform: 'translateX(-50%)',
                                                }}
                                                onMouseEnter={() => setHoveredElement('min')}
                                                onMouseLeave={() => setHoveredElement(null)}
                                            >
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap bg-background px-2 py-1 rounded border shadow-sm">
                                                    ${data.eventStats.price}
                                                </div>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="text-xs font-medium">Event Price: ${data.eventStats.price}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>

                        <div className="flex justify-between text-xs text-muted-foreground mb-2 mt-8">
                            <span className="font-medium">${data.categoryStats.minPrice}</span>
                            <span className="font-medium">${data.categoryStats.maxPrice}</span>
                        </div>

                        {/* Simplified legend */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground mt-3 pt-3 border-t">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-primary" />
                                <span>This event</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-0.5 h-3 bg-border" />
                                <span>Category median</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 bg-emerald-500/20" />
                                <span>Value zone (bottom third of price range)</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg border-2 bg-linear-to-br from-muted/50 to-transparent">
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="h-4 w-4 text-secondary" />
                                <span className="text-sm font-medium">Popularity Rating</span>
                            </div>
                            <div className="flex items-end gap-3">
                                <div className="text-4xl font-bold">
                                    {data.eventStats.popularity}%
                                </div>
                                <Badge
                                    variant="outline"
                                    className={`mb-1.5 ${getPercentileColour(data.percentiles.popularityPercentile)}`}
                                >
                                    {getPercentileLabel(data.percentiles.popularityPercentile)}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                Based on views and engagement relative to category average
                            </p>
                        </div>

                        <div className="p-4 rounded-lg border-2 bg-linear-to-br from-primary/5 to-transparent">
                            <div className="flex items-center gap-2 mb-3">
                                <BarChart3 className="h-4 w-4" />
                                <span className="text-sm font-medium">Category Insights</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-muted-foreground text-xs">Average Price</span>
                                    <div className="font-medium text-base">${data.categoryStats.avgPrice}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground text-xs">Median Price</span>
                                    <div className="font-medium text-base">${data.categoryStats.medianPrice}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground text-xs">Total Events</span>
                                    <div className="font-medium text-base">{data.categoryStats.totalEvents.toLocaleString()}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground text-xs">Avg Popularity</span>
                                    <div className="font-medium text-base">{data.categoryStats.avgPopularity}%</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {data.similarEvents.length > 0 && (
                    <div className="lg:col-span-1">
                        <div className="sticky top-4">
                            <div className="mb-4">
                                <h4 className="text-sm font-semibold mb-1">Similar Events</h4>
                                <p className="text-xs text-muted-foreground">
                                    Events with similar pricing
                                </p>
                            </div>

                            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                                {data.similarEvents.map((event) => (
                                    <Link
                                        key={event._id}
                                        href={`/events/${event._id}`}
                                        className="block p-3 rounded-lg border-2 bg-card transition-all hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 hover:scale-[1.02]"
                                    >
                                        <div className="flex justify-between items-start gap-2 mb-2">
                                            <h5 className="font-medium text-sm line-clamp-2 flex-1">
                                                {event.title}
                                            </h5>
                                            <span className="text-sm font-bold text-primary shrink-0">
                                                {event.priceMax && event.priceMax > event.price
                                                    ? `$${event.price}-${event.priceMax}`
                                                    : `$${event.price}`}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <TrendingUp className="h-3 w-3" />
                                                {event.popularity}%
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ChartWrapper>
    );
}