// components/analytics/TimelineChart.tsx
'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2, Calendar } from 'lucide-react';
import { ChartWrapper } from './ChartWrapper';
import { CategoryFilter, CATEGORY_COLORS } from './CategoryFilter';
import type { TimelineData } from '@/lib/services';

export function TimelineChart() {
    const [data, setData] = useState<TimelineData[]>([]);
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
        new Set(data.flatMap(item => Object.keys(item).filter(k => k !== 'month' && k !== 'total')))
    );

    const peakMonth = data.length > 0 ? data.reduce((max, curr) => curr.total > max.total ? curr : max, data[0]) : null;

    return (
        <ChartWrapper
            icon={Calendar}
            title="Events Timeline"
            description="Event distribution over the next 6 months"
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
            {data.length > 0 ? (
                <>
                    <ResponsiveContainer width="100%" height={300} className="sm:h-[400px]">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 10 }}
                            />
                            <YAxis
                                label={{ value: 'Number of Events', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                                tick={{ fontSize: 10 }}
                            />
                            <Tooltip content={<TimelineTooltip />} />
                            <Legend
                                wrapperStyle={{ fontSize: '11px' }}
                                iconType="circle"
                            />

                            {categories.map(category => (
                                <Area
                                    key={category}
                                    type="monotone"
                                    dataKey={category}
                                    stackId="1"
                                    stroke={CATEGORY_COLORS[category]}
                                    fill={CATEGORY_COLORS[category]}
                                    fillOpacity={0.6}
                                    name={category.charAt(0).toUpperCase() + category.slice(1)}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>

                    {/* Insights */}
                    {peakMonth && (
                        <div className="mt-6 p-4 bg-muted/30 rounded-lg border-2">
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