// components/analytics/popularity-scatter-chart.tsx
'use client';

import { useEffect, useState } from 'react';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ZAxis
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loader2, TrendingUp } from 'lucide-react';
import type { PopularityData } from '@/lib/services/analyticsService';

const CATEGORY_COLORS: Record<string, string> = {
    music: '#8b5cf6',
    theatre: '#ec4899',
    sports: '#f59e0b',
    arts: '#10b981',
    family: '#3b82f6',
    other: '#6b7280'
};

export function PopularityScatterChart() {
    const [data, setData] = useState<PopularityData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetch('/api/analytics/popularity')
            .then(res => res.json())
            .then(result => {
                setData(result.data || []);
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Failed to load popularity data:', err);
                setIsLoading(false);
            });
    }, []);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Price vs Popularity
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    // Group data by category for separate scatter series
    const categories = Array.from(new Set(data.map(d => d.category)));
    const dataByCategory = categories.map(cat => ({
        category: cat,
        data: data.filter(d => d.category === cat).map(d => ({
            ...d,
            x: d.priceMin,
            y: d.popularity * 100, // Convert to percentage
            z: Math.max(d.favourites, 1) * 50 // Size by favourites
        }))
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Price vs Popularity Analysis
                </CardTitle>
                <CardDescription>
                    Discover value: larger bubbles indicate more favorites
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={500}>
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                            type="number"
                            dataKey="x"
                            name="Price"
                            label={{ value: 'Price (AUD)', position: 'bottom' }}
                            domain={[0, 'auto']}
                        />
                        <YAxis
                            type="number"
                            dataKey="y"
                            name="Popularity"
                            label={{ value: 'Popularity %', angle: -90, position: 'insideLeft' }}
                            domain={[0, 100]}
                        />
                        <ZAxis type="number" dataKey="z" range={[50, 400]} />
                        <Tooltip content={<ScatterTooltip />} />
                        <Legend />

                        {dataByCategory.map(({ category, data: categoryData }) => (
                            <Scatter
                                key={category}
                                name={category.charAt(0).toUpperCase() + category.slice(1)}
                                data={categoryData}
                                fill={CATEGORY_COLORS[category]}
                                fillOpacity={0.6}
                            />
                        ))}
                    </ScatterChart>
                </ResponsiveContainer>

                {/* Insight zones */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <div className="font-medium text-green-700 dark:text-green-400 mb-1">
                            💎 Hidden Gems
                        </div>
                        <div className="text-sm text-muted-foreground">
                            High popularity, affordable price
                        </div>
                    </div>
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <div className="font-medium text-amber-700 dark:text-amber-400 mb-1">
                            ⭐ Premium Experiences
                        </div>
                        <div className="text-sm text-muted-foreground">
                            High price, high demand
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function ScatterTooltip({ active, payload }: any) {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload as PopularityData & { x: number; y: number };

    return (
        <div className="bg-background border rounded-lg shadow-lg p-3 max-w-xs">
            <div className="font-medium mb-2 truncate">{data.title}</div>
            <div className="space-y-1 text-sm">
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Category:</span>
                    <span className="capitalize">{data.category}</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-medium">${data.priceMin}</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Popularity:</span>
                    <span className="font-medium">{Math.round(data.popularity * 100)}%</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Favorites:</span>
                    <span className="font-medium">{data.favourites}</span>
                </div>
            </div>
        </div>
    );
}