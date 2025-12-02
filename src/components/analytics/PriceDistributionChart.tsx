// components/analytics/PriceDistributionChart.tsx
'use client';

import { JSX, useEffect, useState } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Rectangle } from 'recharts';
import { Loader2, DollarSign } from 'lucide-react';
import { CATEGORIES } from '@/lib/constants/categories';
import { ChartWrapper } from './ChartWrapper';
import { CategoryFilter, CATEGORY_COLORS } from './CategoryFilter';
import type { PriceDistribution } from '@/lib/services';

export function PriceDistributionChart() {
    const [data, setData] = useState<PriceDistribution[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

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

    const getCategoryKey = (cat: PriceDistribution) => {
        if (cat.isSubcategory) {
            for (const mainCat of CATEGORIES) {
                if (mainCat.subcategories?.includes(cat.category)) {
                    return mainCat.value;
                }
            }
        }
        return cat.category;
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

    const allCategories = Array.from(new Set(data.map(getCategoryKey)));

    // Calculate 95th percentile for better Y-axis scaling
    const allPrices = data.flatMap(d => [d.min, d.q1, d.median, d.q3, d.max]);
    const sortedPrices = allPrices.sort((a, b) => a - b);
    const percentile95 = sortedPrices[Math.floor(sortedPrices.length * 0.95)] || 100;
    const yAxisMax = Math.ceil(percentile95 * 1.15);

    // Custom shape that renders both full range and IQR as overlapping bars
    const OverlappingBars = (props: any): JSX.Element => {
        const { x, y, width, height, payload, index } = props;

        // Return empty rect if no data
        if (!payload || index === undefined || !data[index]) {
            return <rect x={x} y={y} width={0} height={0} />;
        }

        const entry = data[index];
        const categoryKey = getCategoryKey(entry);
        const isHovered = hoveredCategory === null || hoveredCategory === categoryKey;
        const color = getColorForCategory(entry);

        // Calculate Y positions for the chart coordinate system
        const yAxisMaxValue = yAxisMax;

        // Calculate pixel positions from price values
        const minY = y + height - ((entry.min / yAxisMaxValue) * height);
        const maxY = y + height - ((entry.max / yAxisMaxValue) * height);
        const q1Y = y + height - ((entry.q1 / yAxisMaxValue) * height);
        const q3Y = y + height - ((entry.q3 / yAxisMaxValue) * height);

        const fullRangeHeight = Math.max(0, minY - maxY);
        const iqrHeight = Math.max(0, q1Y - q3Y);

        return (
            <g>
                {/* Full range bar (light) */}
                <rect
                    x={x}
                    y={maxY}
                    width={width}
                    height={fullRangeHeight}
                    fill={color}
                    opacity={isHovered ? 0.25 : 0.08}
                    rx={3}
                    ry={3}
                />

                {/* IQR bar (dark) - overlaid on top */}
                <rect
                    x={x}
                    y={q3Y}
                    width={width}
                    height={iqrHeight}
                    fill={color}
                    opacity={isHovered ? 0.7 : 0.25}
                    rx={3}
                    ry={3}
                />
            </g>
        );
    };

    return (
        <ChartWrapper
            icon={DollarSign}
            title="Price Distribution"
            description="Compare pricing patterns across categories"
        >
            <div className="mb-6">
                <CategoryFilter
                    selectedCategories={selectedCategories}
                    onCategoryToggle={toggleCategory}
                    onClear={clearFilters}
                    showSubcategories={true}
                />
            </div>

            {data.length > 0 ? (
                <>
                    <ResponsiveContainer width="100%" height={400} className="sm:h-[450px]">
                        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis
                                dataKey="displayName"
                                angle={-45}
                                textAnchor="end"
                                height={80}
                                tick={{ fontSize: 10 }}
                                interval={0}
                            />
                            <YAxis
                                label={{ value: 'Price (AUD)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                                tick={{ fontSize: 10 }}
                                domain={[0, yAxisMax]}
                            />
                            <Tooltip content={<PriceTooltip />} />

                            {/* Single bar component that renders both ranges overlapping */}
                            <Bar
                                dataKey="max"
                                shape={OverlappingBars}
                            >
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`bar-cell-${index}`}
                                        fill={getColorForCategory(entry)}
                                    />
                                ))}
                            </Bar>

                            {/* Median line on top */}
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
                        {data.map((item, index) => {
                            const color = getColorForCategory(item);
                            const categoryKey = getCategoryKey(item);
                            const isHovered = hoveredCategory === categoryKey;

                            return (
                                <div
                                    key={`summary-${index}`}
                                    onMouseEnter={() => setHoveredCategory(categoryKey)}
                                    onMouseLeave={() => setHoveredCategory(null)}
                                    className="p-4 rounded-lg border bg-muted/30 text-left transition-all duration-300 hover:shadow-sm hover:-translate-y-0.5"
                                    style={{
                                        borderColor: isHovered ? color : undefined,
                                        borderWidth: isHovered ? '2px' : '1px',
                                        backgroundColor: isHovered ? `${color}08` : undefined,
                                        transform: isHovered ? 'translateY(-2px) scale(1.02)' : 'translateY(0) scale(1)'
                                    }}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <div
                                            className="w-3 h-3 rounded-full transition-all duration-300"
                                            style={{
                                                backgroundColor: color,
                                                transform: isHovered ? 'scale(1.3)' : 'scale(1)',
                                                boxShadow: isHovered ? `0 0 8px ${color}50` : 'none'
                                            }}
                                        />
                                        <div className="text-xs sm:text-sm font-medium text-muted-foreground truncate transition-colors duration-300"
                                            style={{ color: isHovered ? color : undefined }}
                                        >
                                            {item.displayName}
                                        </div>
                                    </div>

                                    <div className="text-2xl sm:text-3xl font-bold mb-1 transition-all duration-300"
                                        style={{
                                            color: isHovered ? color : undefined,
                                            transform: isHovered ? 'scale(1.05)' : 'scale(1)'
                                        }}
                                    >
                                        ${item.median}
                                    </div>

                                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <span className="font-medium">{item.count}</span> events
                                        </span>
                                        <span className="flex items-center gap-1">
                                            Full range: <span className="font-medium">${item.min}-${item.max}</span>
                                        </span>
                                    </div>

                                    <div className="mt-2 pt-2 border-t text-xs space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Middle 50%:</span>
                                            <span className="font-medium">${item.q1}-${item.q3}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Average:</span>
                                            <span className="font-medium">${item.avgPrice}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Enhanced legend */}
                    <div className="mt-4 p-4 bg-muted/30 rounded-lg border">
                        <div className="text-xs font-medium mb-3 text-muted-foreground">Chart Guide</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                            <div className="flex items-start gap-2">
                                <div className="w-8 h-6 rounded mt-0.5" style={{
                                    background: 'linear-gradient(to right, rgb(59 130 246 / 0.25), rgb(59 130 246 / 0.25))',
                                    border: '1px solid rgb(59 130 246 / 0.4)'
                                }} />
                                <div>
                                    <div className="font-medium">Light bar</div>
                                    <div className="text-muted-foreground">Full price range (min-max)</div>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-8 h-6 rounded mt-0.5" style={{
                                    background: 'linear-gradient(to right, rgb(59 130 246 / 0.7), rgb(59 130 246 / 0.7))',
                                    border: '1px solid rgb(59 130 246 / 0.9)'
                                }} />
                                <div>
                                    <div className="font-medium">Dark bar</div>
                                    <div className="text-muted-foreground">Middle 50% (Q1-Q3), overlaid on light bar</div>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-8 h-0.5 bg-orange-600 rounded mt-2.5" />
                                <div>
                                    <div className="font-medium">Orange line</div>
                                    <div className="text-muted-foreground">Median price (50th percentile)</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Note about scaling */}
                    {yAxisMax < Math.max(...data.map(d => d.max)) && (
                        <div className="mt-2 flex justify-center">
                            <p className="text-xs text-muted-foreground italic">
                                Note: Y-axis scaled to 95th percentile for better visibility of typical prices
                            </p>
                        </div>
                    )}
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
                    <span className="text-muted-foreground">Events:</span>
                    <span className="font-medium">{data.count}</span>
                </div>
                <div className="flex justify-between gap-4 pt-1 border-t">
                    <span className="text-muted-foreground">Full Range:</span>
                    <span className="font-medium">${data.min} - ${data.max}</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Middle 50%:</span>
                    <span className="font-medium">${data.q1} - ${data.q3}</span>
                </div>
                <div className="flex justify-between gap-4 pt-1 border-t">
                    <span className="text-muted-foreground">Median:</span>
                    <span className="font-bold text-orange-600">${data.median}</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Average:</span>
                    <span className="font-medium">${data.avgPrice}</span>
                </div>
            </div>
        </div>
    );
}