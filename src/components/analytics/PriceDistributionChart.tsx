// components/analytics/PriceDistributionChart.tsx
'use client';

import { useEffect, useState } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Loader2, DollarSign } from 'lucide-react';
import { CATEGORIES } from '@/lib/constants/categories';
import { ChartWrapper } from './ChartWrapper';
import { CategoryFilter, CATEGORY_COLORS } from './CategoryFilter';
import type { PriceDistribution } from '@/lib/services';

export function PriceDistributionChart() {
    const [data, setData] = useState<PriceDistribution[]>([]);
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
            const res = await fetch(`/api/analytics/price-distribution${params}`);
            const result = await res.json();
            setData(result.data || []);
        } catch (err) {
            console.error('Failed to load price distribution:', err);
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

    const getColorForCategory = (cat: PriceDistribution) => {
        if (cat.isSubcategory) {
            for (const mainCat of CATEGORIES) {
                if (mainCat.subcategories?.includes(cat.category)) {
                    return CATEGORY_COLORS[mainCat.value] || '#6b7280';
                }
            }
        }
        return CATEGORY_COLORS[cat.category] || '#6b7280';
    };

    if (isLoading) {
        return (
            <ChartWrapper
                icon={DollarSign}
                title="Price Distribution"
                description="Compare pricing patterns across categories"
            >
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </ChartWrapper>
        );
    }

    return (
        <ChartWrapper
            icon={DollarSign}
            title="Price Distribution"
            description="Compare pricing patterns across categories"
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
                        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 50 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis
                                dataKey="displayName"
                                angle={-45}
                                textAnchor="end"
                                height={60}
                                tick={{ fontSize: 10 }}
                                interval={0}
                            />
                            <YAxis
                                label={{ value: 'Price (AUD)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                                tick={{ fontSize: 10 }}
                            />
                            <Tooltip content={<PriceTooltip />} />

                            {/* Transparent bar for Q1 baseline */}
                            <Bar dataKey="q1" stackId="range" fill="transparent" />

                            {/* Interquartile range bar (Q1 to Q3) */}
                            <Bar dataKey={(entry) => entry.q3 - entry.q1} stackId="range">
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`price-cell-${index}`}
                                        fill={getColorForCategory(entry)}
                                        opacity={0.3}
                                    />
                                ))}
                            </Bar>

                            {/* Median price line */}
                            <Line
                                type="monotone"
                                dataKey="median"
                                stroke="rgb(234 88 12)"
                                strokeWidth={2}
                                dot={{ fill: 'rgb(234 88 12)', r: 4 }}
                                name="Median"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
                        {data.map((item, index) => (
                            <div
                                key={`summary-${index}`}
                                className="p-3 rounded-lg border-2 bg-card transition-all hover:shadow-sm"
                                style={{
                                    borderLeftColor: getColorForCategory(item),
                                    borderLeftWidth: 4
                                }}
                            >
                                <div className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                                    {item.displayName}
                                </div>
                                <div className="text-xl sm:text-2xl font-bold mt-1">${item.median}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    {item.count} events • ${item.min}-${item.max}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">No data available</p>
                    <p className="text-xs text-muted-foreground mt-1">Select categories to view pricing</p>
                </div>
            )}
        </ChartWrapper>
    );
}

function PriceTooltip({ active, payload }: any) {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload as PriceDistribution;

    return (
        <div className="bg-background border-2 rounded-lg shadow-lg p-3 text-xs sm:text-sm">
            <div className="font-medium mb-2 truncate">{data.displayName}</div>
            <div className="space-y-1">
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Count:</span>
                    <span className="font-medium">{data.count} events</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Range:</span>
                    <span>${data.min} - ${data.max}</span>
                </div>
                <div className="flex justify-between gap-4 pt-1 border-t">
                    <span className="text-muted-foreground">Median:</span>
                    <span className="font-bold text-primary">${data.median}</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Average:</span>
                    <span className="font-medium">${data.avgPrice}</span>
                </div>
            </div>
        </div>
    );
}