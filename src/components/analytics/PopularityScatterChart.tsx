// components/analytics/PopularityScatterChart.tsx
'use client';

import { useEffect, useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ZAxis, Cell } from 'recharts';
import { Loader2, TrendingUp } from 'lucide-react';
import { ChartWrapper } from './ChartWrapper';
import { CategoryFilter, CATEGORY_COLORS } from './CategoryFilter';
import type { PopularityData } from '@/lib/services/analyticsService';

export function PopularityScatterChart() {
    const [data, setData] = useState<PopularityData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    useEffect(() => {
        fetchData();
    }, [selectedCategories]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const params = selectedCategories.length > 0
                ? `?categories=${selectedCategories.join(',')}`
                : '';
            console.log('[Popularity Chart] Fetching with params:', params);
            console.log('[Popularity Chart] Selected categories:', selectedCategories);
            
            const res = await fetch(`/api/analytics/popularity${params}`);
            const result = await res.json();
            
            console.log('[Popularity Chart] Received data:', result.data?.length, 'events');
            
            setData(result.data || []);
        } catch (err) {
            console.error('Failed to load popularity data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleCategory = (category: string) => {
        setSelectedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    const clearFilters = () => setSelectedCategories([]);

    if (isLoading) {
        return (
            <ChartWrapper
                icon={TrendingUp}
                title="Popularity Analysis"
                description="Price vs popularity correlation (bubble size = favorites)"
            >
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </ChartWrapper>
        );
    }

    const chartData = data.map(d => ({
        ...d,
        x: d.priceMin,
        y: d.popularity * 100,
        z: Math.max(d.favourites, 1) * 50
    }));

    // Get unique categories for separate scatter series
    const categoriesInData = Array.from(new Set(chartData.map(d => d.category)));

    return (
        <ChartWrapper
            icon={TrendingUp}
            title="Popularity Analysis"
            description="Price vs popularity correlation (bubble size = favorites)"
        >
            {/* Filter Section */}
            <div className="mb-6">
                <CategoryFilter
                    selectedCategories={selectedCategories}
                    onCategoryToggle={toggleCategory}
                    onClear={clearFilters}
                    showSubcategories={true}
                />
            </div>

            {/* Chart */}
            {chartData.length > 0 ? (
                <>
                    <ResponsiveContainer width="100%" height={300} className="sm:h-[400px]">
                        <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis
                                type="number"
                                dataKey="x"
                                name="Price"
                                label={{ value: 'Price (AUD)', position: 'bottom', style: { fontSize: 11 } }}
                                tick={{ fontSize: 10 }}
                                domain={[0, 'auto']}
                            />
                            <YAxis
                                type="number"
                                dataKey="y"
                                name="Popularity"
                                label={{ value: 'Popularity %', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                                tick={{ fontSize: 10 }}
                                domain={[0, 100]}
                            />
                            <ZAxis type="number" dataKey="z" range={[30, 300]} />
                            <Tooltip content={<PopularityTooltip />} />
                            <Legend 
                                wrapperStyle={{ fontSize: '11px' }}
                                iconType="circle"
                                formatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
                            />

                            {categoriesInData.map(category => (
                                <Scatter
                                    key={category}
                                    name={category.charAt(0).toUpperCase() + category.slice(1)}
                                    data={chartData.filter(d => d.category === category)}
                                    fill={CATEGORY_COLORS[category]}
                                    fillOpacity={0.6}
                                />
                            ))}
                        </ScatterChart>
                    </ResponsiveContainer>

                    {/* Insight Zones */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                        <div className="p-3 sm:p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <div className="text-xs sm:text-sm font-semibold text-green-700 dark:text-green-400">
                                    Value Zone
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                High popularity with affordable pricing
                            </div>
                        </div>
                        <div className="p-3 sm:p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                                <div className="text-xs sm:text-sm font-semibold text-amber-700 dark:text-amber-400">
                                    Premium Zone
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                High price with strong demand
                            </div>
                        </div>
                    </div>

                    {/* Statistics */}
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
                        <div className="text-sm font-medium mb-3 text-foreground">Statistics</div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs sm:text-sm">
                            <div className="flex flex-col">
                                <span className="text-muted-foreground">Events</span>
                                <span className="font-medium text-lg">{chartData.length}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-muted-foreground">Avg Price</span>
                                <span className="font-medium text-lg">
                                    ${Math.round(chartData.reduce((sum, d) => sum + d.priceMin, 0) / chartData.length)}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-muted-foreground">Avg Popularity</span>
                                <span className="font-medium text-lg">
                                    {Math.round(chartData.reduce((sum, d) => sum + d.y, 0) / chartData.length)}%
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-muted-foreground">Total Favorites</span>
                                <span className="font-medium text-lg">
                                    {chartData.reduce((sum, d) => sum + d.favourites, 0)}
                                </span>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="py-12 text-center text-sm text-muted-foreground">
                    <p>No data available</p>
                    <p className="text-xs mt-1">Select categories to view analysis</p>
                </div>
            )}
        </ChartWrapper>
    );
}

function PopularityTooltip({ active, payload }: any) {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload as PopularityData & { x: number; y: number };

    return (
        <div className="bg-background border rounded-lg shadow-lg p-3 max-w-[220px] text-xs sm:text-sm">
            <div className="font-medium mb-2 truncate">{data.title}</div>
            <div className="space-y-1">
                <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Category:</span>
                    <span className="font-medium capitalize">{data.category}</span>
                </div>
                <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-medium">${data.priceMin}</span>
                </div>
                <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Popularity:</span>
                    <span className="font-medium">{Math.round(data.popularity * 100)}%</span>
                </div>
                <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Favorites:</span>
                    <span className="font-medium">{data.favourites}</span>
                </div>
            </div>
        </div>
    );
}