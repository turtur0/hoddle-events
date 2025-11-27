// app/insights/page.tsx
'use client';

import { useState } from 'react';
import { PopularityScatterChart } from '@/components/analytics/PopularityScatterChart';
import { PriceDistributionChart } from '@/components/analytics/PriceDistributionChart';
import { TimelineChart } from '@/components/analytics/TimelineChart';
import { Sparkles, TrendingUp, DollarSign, Calendar, BarChart3, Grid3x3, List } from 'lucide-react';
import { BackButton } from '@/components/navigation/BackButton';

const AVAILABLE_CHARTS = [
    {
        id: 'price-distribution',
        name: 'Price Distribution',
        component: PriceDistributionChart,
        icon: DollarSign,
    },
    {
        id: 'timeline',
        name: 'Event Timeline',
        component: TimelineChart,
        icon: Calendar,
    },
    {
        id: 'popularity-scatter',
        name: 'Popularity Analysis',
        component: PopularityScatterChart,
        icon: TrendingUp,
    },
];

export default function InsightsPage() {
    const [selectedCharts, setSelectedCharts] = useState(
        AVAILABLE_CHARTS.map(c => c.id)
    );
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showSelector, setShowSelector] = useState(false);

    const toggleChart = (chartId: string) => {
        setSelectedCharts(prev =>
            prev.includes(chartId)
                ? prev.filter(id => id !== chartId)
                : [...prev, chartId]
        );
    };

    const displayedCharts = AVAILABLE_CHARTS.filter(chart =>
        selectedCharts.includes(chart.id)
    );

    return (
        <div className="w-full min-h-screen bg-linear-to-b from-background to-muted/20">
            {/* Header */}
            <section className="border-b bg-background/95 backdrop-blur sticky top-14 sm:top-16 z-10">
                <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                    <BackButton fallbackUrl="/" className="mb-4" />
                    
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        {/* Title */}
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-primary/10 p-2.5 ring-1 ring-primary/20">
                                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold">Event Insights</h1>
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                    Melbourne's event trends
                                </p>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2">
                            {/* View Mode Toggle - Hidden on mobile */}
                            <div className="hidden sm:flex items-center rounded-lg border bg-background p-1">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 rounded transition-colors ${
                                        viewMode === 'grid'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    title="Grid view"
                                >
                                    <Grid3x3 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 rounded transition-colors ${
                                        viewMode === 'list'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    title="List view"
                                >
                                    <List className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Chart Selector */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowSelector(!showSelector)}
                                    className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border bg-background hover:bg-accent transition-colors text-sm font-medium"
                                >
                                    <BarChart3 className="h-4 w-4" />
                                    <span className="hidden sm:inline">Customize</span>
                                    <span className="sm:hidden">Charts</span>
                                    <span className="text-xs">({selectedCharts.length})</span>
                                </button>

                                {showSelector && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-20"
                                            onClick={() => setShowSelector(false)}
                                        />
                                        <div className="absolute right-0 mt-2 w-64 sm:w-72 rounded-xl border bg-background shadow-lg z-30 overflow-hidden">
                                            <div className="p-3 sm:p-4 border-b bg-muted/50">
                                                <h3 className="font-semibold text-sm">Select Charts</h3>
                                            </div>
                                            <div className="max-h-[60vh] sm:max-h-[400px] overflow-y-auto">
                                                {AVAILABLE_CHARTS.map((chart) => {
                                                    const Icon = chart.icon;
                                                    const isSelected = selectedCharts.includes(chart.id);
                                                    return (
                                                        <label
                                                            key={chart.id}
                                                            className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer transition-colors border-b last:border-b-0"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleChart(chart.id)}
                                                                className="rounded border-gray-300 text-primary focus:ring-primary"
                                                            />
                                                            <Icon className="h-4 w-4 text-primary" />
                                                            <span className="text-sm font-medium">{chart.name}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Empty State */}
            {displayedCharts.length === 0 && (
                <section className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                    <div className="text-center py-12">
                        <BarChart3 className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground/50 mb-4" />
                        <h3 className="text-lg sm:text-xl font-semibold mb-2">No charts selected</h3>
                        <p className="text-sm text-muted-foreground">
                            Click "Charts" to select visualizations
                        </p>
                    </div>
                </section>
            )}

            {/* Charts */}
            {displayedCharts.length > 0 && (
                <section className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                    <div
                        className={
                            viewMode === 'grid'
                                ? 'grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6'
                                : 'space-y-4 sm:space-y-6'
                        }
                    >
                        {displayedCharts.map((chart) => {
                            const ChartComponent = chart.component;
                            return <ChartComponent key={chart.id} />;
                        })}
                    </div>
                </section>
            )}
        </div>
    );
}