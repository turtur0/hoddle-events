// components/analytics/TimelineChart.tsx
'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Loader2, Calendar } from 'lucide-react';
import { ChartWrapper } from './ChartWrapper';
import { CategoryFilter, CATEGORY_COLORS } from './CategoryFilter';
import type { TimelineData } from '@/lib/services';

export function TimelineChart() {
    const [data, setData] = useState<TimelineData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'stacked' | 'separate'>('stacked');

    useEffect(() => {
        fetchData();
    }, [selectedCategories]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const params = selectedCategories.length > 0
                ? `?categories=${selectedCategories.join(',')}`
                : '';

            const res = await fetch(`/api/analytics/timeline${params}`);
            const result = await res.json();

            setData(result.data || []);
        } catch (err) {
            console.error('Failed to load timeline:', err);
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
                icon={Calendar}
                title="Events Timeline"
                description="Event distribution over the next 6 months"
            >
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </ChartWrapper>
        );
    }

    const categories = Array.from(
        new Set(data.flatMap(item => Object.keys(item).filter(k => k !== 'month' && k !== 'total' && k !== 'monthDate')))
    );

    const peakMonth = data.length > 0 ? data.reduce((max, curr) => curr.total > max.total ? curr : max, data[0]) : null;
    const maxEvents = data.length > 0 ? Math.max(...data.map(d => d.total)) : 0;

    return (
        <ChartWrapper
            icon={Calendar}
            title="Events Timeline"
            description="Event distribution over the next 6 months"
        >
            <div className="mb-6 space-y-4">
                <CategoryFilter
                    selectedCategories={selectedCategories}
                    onCategoryToggle={toggleCategory}
                    onClear={clearFilters}
                    showSubcategories={true}
                />

                {/* View mode toggle */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">View:</span>
                    <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
                        <button
                            onClick={() => setViewMode('stacked')}
                            className={`px-3 py-1 text-xs rounded transition-all ${viewMode === 'stacked'
                                    ? 'bg-background shadow-sm font-medium'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Stacked (Total)
                        </button>
                        <button
                            onClick={() => setViewMode('separate')}
                            className={`px-3 py-1 text-xs rounded transition-all ${viewMode === 'separate'
                                    ? 'bg-background shadow-sm font-medium'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Separate (Individual)
                        </button>
                    </div>
                </div>
            </div>

            {data.length > 0 ? (
                <>
                    {viewMode === 'stacked' ? (
                        <ResponsiveContainer width="100%" height={300} className="sm:h-[400px]">
                            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                <XAxis
                                    dataKey="month"
                                    tick={{ fontSize: 10 }}
                                    label={{ value: 'Month', position: 'insideBottom', offset: -5, style: { fontSize: 11 } }}
                                />
                                <YAxis
                                    label={{ value: 'Total Events (Cumulative)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                                    tick={{ fontSize: 10 }}
                                    domain={[0, Math.ceil(maxEvents * 1.1)]}
                                />
                                <Tooltip content={<TimelineTooltip />} />

                                {categories.map(category => (
                                    <Area
                                        key={category}
                                        type="monotone"
                                        dataKey={category}
                                        stackId="1"
                                        stroke={CATEGORY_COLORS[category]}
                                        fill={CATEGORY_COLORS[category]}
                                        fillOpacity={hoveredCategory === null || hoveredCategory === category ? 0.6 : 0.1}
                                        strokeOpacity={hoveredCategory === null || hoveredCategory === category ? 1 : 0.3}
                                        strokeWidth={hoveredCategory === category ? 3 : 2}
                                        name={category.charAt(0).toUpperCase() + category.slice(1)}
                                    />
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <ResponsiveContainer width="100%" height={300} className="sm:h-[400px]">
                            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                <XAxis
                                    dataKey="month"
                                    tick={{ fontSize: 10 }}
                                    label={{ value: 'Month', position: 'insideBottom', offset: -5, style: { fontSize: 11 } }}
                                />
                                <YAxis
                                    label={{ value: 'Events per Category', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                                    tick={{ fontSize: 10 }}
                                    domain={[0, 'auto']}
                                />
                                <Tooltip content={<TimelineTooltip />} />

                                {categories.map(category => (
                                    <Line
                                        key={category}
                                        type="monotone"
                                        dataKey={category}
                                        stroke={CATEGORY_COLORS[category]}
                                        strokeOpacity={hoveredCategory === null || hoveredCategory === category ? 1 : 0.3}
                                        strokeWidth={hoveredCategory === category ? 3 : 2}
                                        dot={{ fill: CATEGORY_COLORS[category], r: 3 }}
                                        activeDot={{ r: 5 }}
                                        name={category.charAt(0).toUpperCase() + category.slice(1)}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    )}

                    <div className="flex flex-wrap gap-3 mt-4 justify-center">
                        {categories.map(category => (
                            <div
                                key={category}
                                onMouseEnter={() => setHoveredCategory(category)}
                                onMouseLeave={() => setHoveredCategory(null)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all"
                                style={{
                                    borderColor: hoveredCategory === category ? CATEGORY_COLORS[category] : 'transparent',
                                    backgroundColor: hoveredCategory === category ? `${CATEGORY_COLORS[category]}15` : 'transparent'
                                }}
                            >
                                <div
                                    className="w-3 h-3 rounded-full transition-transform"
                                    style={{
                                        backgroundColor: CATEGORY_COLORS[category],
                                        transform: hoveredCategory === category ? 'scale(1.2)' : 'scale(1)'
                                    }}
                                />
                                <span className="text-sm font-medium capitalize">{category}</span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 p-3 bg-muted/30 rounded-lg border text-xs text-muted-foreground">
                        {viewMode === 'stacked' ? (
                            <p>
                                <strong>Stacked view:</strong> Shows total events per month with categories stacked on top of each other.
                                The top of the chart represents the total number of events across all categories.
                            </p>
                        ) : (
                            <p>
                                <strong>Separate view:</strong> Shows individual category trends as separate lines.
                                Better for comparing how each category performs independently over time.
                            </p>
                        )}
                    </div>

                    {peakMonth && (
                        <div className="mt-4 p-4 bg-muted/30 rounded-lg border-2">
                            <div className="text-sm font-medium mb-3">Key Insights</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Peak Month:</span>
                                    <span className="font-medium">{peakMonth.month}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Peak Events:</span>
                                    <span className="font-medium">{peakMonth.total}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Events:</span>
                                    <span className="font-medium">{data.reduce((sum, curr) => sum + curr.total, 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Time Period:</span>
                                    <span className="font-medium">{data.length} months</span>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">No data available</p>
                    <p className="text-xs text-muted-foreground mt-1">Select categories to view timeline</p>
                </div>
            )}
        </ChartWrapper>
    );
}

function TimelineTooltip({ active, payload, label }: any) {
    if (!active || !payload || !payload.length) return null;

    return (
        <div className="bg-background border-2 rounded-lg shadow-lg p-3 text-xs sm:text-sm">
            <div className="font-medium mb-2">{label}</div>
            <div className="space-y-1">
                {payload
                    .sort((a: any, b: any) => b.value - a.value)
                    .map((entry: any) => (
                        <div key={entry.name} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: entry.color }} />
                                <span className="capitalize">{entry.name}:</span>
                            </div>
                            <span className="font-medium">{entry.value}</span>
                        </div>
                    ))}
                <div className="flex justify-between gap-4 pt-1.5 border-t mt-1.5 font-medium">
                    <span>Total:</span>
                    <span>{payload.reduce((sum: number, entry: any) => sum + entry.value, 0)}</span>
                </div>
            </div>
        </div>
    );
}