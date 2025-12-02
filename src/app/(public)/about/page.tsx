// app/about/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLayout } from '@/components/layout/PageLayout';
import {
    Database,
    Shield,
    Bell,
    BarChart3,
    Mail,
    Github,
    Target,
    ExternalLink,
    Sparkles,
    CheckCircle2
} from "lucide-react";
import Link from "next/link";

export const metadata = {
    title: "About Melbourne Events | Your Complete Guide to What's On in Melbourne",
    description: "Discover how Melbourne Events brings together concerts, theatre, sports and more. Set custom alerts, compare pricing and explore event trends across Melbourne.",
};

const DATA_SOURCES = [
    {
        name: 'Ticketmaster',
        url: 'https://www.ticketmaster.com.au/',
        badge: { label: 'Primary', variant: 'default' as const },
        description: 'Major concerts, sports events and theatre productions via the official Discovery API.',
    },
    {
        name: 'Marriner Group',
        url: 'https://marrinergroup.com.au/',
        badge: { label: 'Venue', variant: 'secondary' as const },
        description: "Premium theatre, musicals and performing arts across Melbourne's finest venues.",
        venues: ['Regent Theatre', 'Princess Theatre', 'Comedy Theatre', 'Forum Melbourne', 'Plaza Ballroom'],
    },
    {
        name: 'What\'s On Melbourne',
        url: 'https://whatson.melbourne.vic.gov.au/',
        badge: { label: 'Community', variant: 'outline' as const },
        description: 'Festivals, exhibitions and cultural events from the City of Melbourne.',
    },
];

const FEATURES = [
    {
        icon: Target,
        title: "One Search, Every Event",
        desc: "Stop checking multiple websites. Find concerts, theatre, sports and festivals all in one place."
    },
    {
        icon: Bell,
        title: "Smart Alerts, Your Way",
        desc: "Ditch the spam. Set custom notifications for exactly what you want, like your favourite artists, venues or event types."
    },
    {
        icon: BarChart3,
        title: "Powerful Insights",
        desc: "Compare ticket prices across categories, spot seasonal trends and discover the best value events."
    },
    {
        icon: Database,
        title: "Complete Event Archive",
        desc: "Explore Melbourne's event history. Our archive preserves past concerts, shows and festivals for research, trend analysis and cultural reference."
    },
];

const ETHICAL_PRACTICES = [
    {
        title: "Official APIs first",
        desc: "We use official data sources wherever available and respect all terms of service."
    },
    {
        title: "Direct attribution",
        desc: "All bookings link directly to the official ticketing source. We don't sell tickets."
    },
    {
        title: "Respectful scraping",
        desc: "We follow robots.txt rules, implement rate limiting and avoid overload source servers."
    },
    {
        title: "Transparent data use",
        desc: "We collect event interactions (views, favourites) to improve recommendations. Your data stays private and is never sold."
    },
];

export default function AboutPage() {
    return (
        <PageLayout
            icon={Sparkles}
            iconColor="text-primary"
            iconBgColor="bg-primary/10 ring-1 ring-primary/20"
            title="About Melbourne Events"
            description="Making it easier to discover what's on in Melbourne"
            maxWidth="4xl"
        >
            <div className="space-y-8">
                {/* Mission */}
                <Card className="card-interactive">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-2xl">
                            <Target className="h-6 w-6 text-primary" />
                            Why We Built This
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-base leading-relaxed">
                        <p className="text-muted-foreground">
                            Melbourne has an incredible cultural scene, but finding events shouldn't be as challenging as it is.
                        </p>
                        <p className="text-muted-foreground">
                            Finding what's on often means checking multiple ticketing sites, signing up for endless newsletters, and manually tracking
                            venues, or worse, missing your favourite artist because you found out too late. We thought there had to be a better way.
                        </p>
                        <p className="text-muted-foreground">
                            Melbourne Events brings it all together: concerts, theatre, sports and festivals in one search. Get custom alerts
                            for what you actually care about, explore pricing trends across our entire database, and dive into our archive
                            of past events preserving Melbourne's cultural history for future reference and research..
                        </p>
                    </CardContent>
                </Card>

                {/* Features */}
                <Card className="card-interactive">
                    <CardHeader>
                        <CardTitle className="text-2xl">What Makes Us Different</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-6 md:grid-cols-2">
                            {FEATURES.map((feature, i) => {
                                const Icon = feature.icon;
                                return (
                                    <div key={i} className="p-5 rounded-xl border-2 bg-muted/30 transition-all hover:shadow-sm hover-lift">
                                        <Icon className="h-8 w-8 text-primary mb-3" />
                                        <h4 className="font-bold text-base mb-2">{feature.title}</h4>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {feature.desc}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Data Sources */}
                <Card className="card-interactive">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-2xl">
                            <Database className="h-6 w-6 text-primary" />
                            Where Our Data Comes From
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground mb-6 text-base">
                            We aggregate events from trusted sources, updated daily:
                        </p>
                        <div className="space-y-4">
                            {DATA_SOURCES.map((source) => (
                                <div key={source.name} className="p-5 rounded-xl border-2 bg-muted/30 transition-all hover:shadow-sm hover-lift">
                                    <div className="flex items-start gap-4">
                                        <Badge variant={source.badge.variant} className="mt-1 shrink-0">
                                            {source.badge.label}
                                        </Badge>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <h4 className="font-bold text-base">{source.name}</h4>
                                                <a
                                                    href={source.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:text-primary/80 transition-colors shrink-0"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            </div>
                                            <p className="text-muted-foreground text-sm mb-3">
                                                {source.description}
                                            </p>
                                            {source.venues && (
                                                <div className="flex flex-wrap gap-2">
                                                    {source.venues.map(venue => (
                                                        <Badge
                                                            key={venue}
                                                            variant="outline"
                                                            className="badge-outline-hover text-xs"
                                                        >
                                                            {venue}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 p-4 rounded-xl border bg-muted/30">
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                <strong className="text-foreground">Smart deduplication:</strong> Events appearing on multiple platforms are automatically merged to show you the most complete information.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Ethical Practices */}
                <Card className="card-interactive">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-2xl">
                            <Shield className="h-6 w-6 text-primary" />
                            How We Operate Responsibly
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground mb-6 text-base">
                            Data ethics matter. Here's our commitment:
                        </p>
                        <ul className="grid gap-3 sm:grid-cols-2">
                            {ETHICAL_PRACTICES.map((item, i) => (
                                <li key={i} className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30 transition-all hover:shadow-sm hover-lift">
                                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                    <div>
                                        <strong className="text-foreground text-sm">{item.title}</strong>
                                        <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>

                {/* Contact */}
                <Card className="card-interactive">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-2xl">
                            <Mail className="h-6 w-6 text-primary" />
                            Get in Touch
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground mb-6 text-base">
                            Questions, feedback or found a bug? We'd love to hear from you.
                        </p>
                        <div className="flex flex-wrap gap-4 mb-6">
                            <Button variant="outline" size="lg" asChild className="border-2 transition-all hover-lift">
                                <a href="mailto:hello@melbourneevents.com.au" className="flex items-center">
                                    <Mail className="h-5 w-5 mr-2" />
                                    hello@melbourneevents.com.au
                                </a>
                            </Button>
                            <Button variant="outline" size="lg" asChild className="border-2 transition-all hover-lift">
                                <a
                                    href="https://github.com/turtur0/events-aggregator"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center"
                                >
                                    <Github className="h-5 w-5 mr-2" />
                                    View on GitHub
                                </a>
                            </Button>
                        </div>
                        <div className="p-4 rounded-xl border bg-muted/30">
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                <strong className="text-foreground">Event organisers:</strong> Need your events removed? Contact us and we'll process your request within 48 hours.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageLayout>
    );
}