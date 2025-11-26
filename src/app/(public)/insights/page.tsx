
// app/insights/page.tsx
import { PopularityScatterChart } from '@/components/analytics/PopularityScratterChart';
import { PriceDistributionChart } from '@/components/analytics/PriceDistributionChart';
import { TimelineChart } from '@/components/analytics/TimelineChart';
import { Sparkles } from 'lucide-react';

export default function InsightsPage() {
    return (
        <div className="w-full min-h-screen bg-linear-to-b from-background to-muted/20">
            {/* Header */}
            <section className="border-b bg-background/95 backdrop-blur">
                <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                    <div className="flex items-center gap-4">
                        <div className="rounded-2xl bg-primary/10 p-3 ring-1 ring-primary/20">
                            <Sparkles className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Event Insights</h1>
                            <p className="text-muted-foreground mt-1">
                                Discover trends and patterns in Melbourne's event landscape
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Charts */}
            <section className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                <div className="space-y-8">
                    <PriceDistributionChart />
                    <TimelineChart />
                    <PopularityScatterChart />
                </div>
            </section>
        </div>
    );
}