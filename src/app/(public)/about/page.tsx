import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { BackButton } from '@/components/navigation/BackButton';
import {
    Database,
    Shield,
    Clock,
    Mail,
    Github,
    Heart,
    ExternalLink,
    Sparkles,
    CheckCircle2
} from "lucide-react";
import Link from "next/link";

export const metadata = {
    title: "About | Melbourne Events",
    description: "Learn about Melbourne Events, our data sources, and ethical practices.",
};

export default function AboutPage() {
    return (
        <div className="w-full">
            {/* Hero Section */}
            <section className="bg-linear-to-b from-primary/5 via-background to-background">
                <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                    <BackButton fallbackUrl="/" className="mb-8" />

                    <div className="flex items-start gap-4 mb-4">
                        <div className="rounded-2xl bg-primary/10 p-3 ring-1 ring-primary/20">
                            <Sparkles className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">
                                About Melbourne Events
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                A comprehensive events aggregator built to help Melburnians discover
                                what's happening in their city.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Content */}
            <section className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                <div className="space-y-8">
                    {/* Mission */}
                    <Card className="border-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-2xl">
                                <div className="rounded-lg bg-muted p-2">
                                    <Heart className="h-6 w-6 text-foreground" />
                                </div>
                                Our Mission
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-base leading-relaxed">
                            <p className="text-muted-foreground">
                                Melbourne is one of the world's most vibrant cities for live events,
                                but finding what's on can be frustrating. Event information is scattered
                                across multiple ticketing platforms, venue websites, and social media.
                            </p>
                            <p className="text-muted-foreground">
                                Melbourne Events solves this by aggregating events from multiple trusted
                                sources into one searchable, filterable platform. Whether you're looking
                                for a concert tonight or planning ahead for festival season, we've got you covered.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Data Sources */}
                    <Card className="border-2" id="data-sources">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-2xl">
                                <div className="rounded-lg bg-muted p-2">
                                    <Database className="h-6 w-6 text-foreground" />
                                </div>
                                Data Sources
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground mb-6 text-base">
                                We aggregate event data from the following trusted sources:
                            </p>
                            <div className="space-y-4">
                                {/* Ticketmaster */}
                                <div className="p-6 rounded-xl border-2 bg-muted/30 transition-all hover:shadow-sm">
                                    <div className="flex items-start gap-4">
                                        <Badge className="mt-1 bg-primary text-primary-foreground">Primary</Badge>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h4 className="font-bold text-lg">Ticketmaster</h4>
                                                <a
                                                    href="https://www.ticketmaster.com.au/"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:text-primary/80 transition-colors"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            </div>
                                            <p className="text-muted-foreground">
                                                Major concerts, sports events, and theatre productions via their official Discovery API.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Marriner Group */}
                                <div className="p-6 rounded-xl border-2 bg-muted/30 transition-all hover:shadow-sm">
                                    <div className="flex items-start gap-4">
                                        <Badge variant="secondary" className="mt-1">Venue</Badge>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h4 className="font-bold text-lg">Marriner Group</h4>
                                                <a
                                                    href="https://marrinergroup.com.au/"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:text-primary/80 transition-colors"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            </div>
                                            <p className="text-muted-foreground mb-3">
                                                Theatre, musicals, and performing arts from Melbourne's premier entertainment venues.
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {['Regent Theatre', 'Princess Theatre', 'Comedy Theatre', 'Forum Melbourne', 'Plaza Ballroom'].map(venue => (
                                                    <Badge
                                                        key={venue}
                                                        variant="outline"
                                                        className="bg-background transition-all hover:bg-muted"
                                                    >
                                                        {venue}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* What's On */}
                                <div className="p-6 rounded-xl border-2 bg-muted/30 transition-all hover:shadow-sm">
                                    <div className="flex items-start gap-4">
                                        <Badge variant="outline" className="mt-1">Secondary</Badge>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h4 className="font-bold text-lg">What's On Melbourne</h4>
                                                <a
                                                    href="https://whatson.melbourne.vic.gov.au/"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:text-primary/80 transition-colors"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            </div>
                                            <p className="text-muted-foreground">
                                                Community events, festivals, and cultural activities curated by the City of Melbourne.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 p-5 rounded-xl border-2 bg-muted/30">
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                    <strong className="text-foreground">Note:</strong> We automatically deduplicate events
                                    that appear across multiple sources, merging information to provide you with the most
                                    complete and accurate event details.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Ethical Practices */}
                    <Card className="border-2" id="ethics">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-2xl">
                                <div className="rounded-lg bg-muted p-2">
                                    <Shield className="h-6 w-6 text-foreground" />
                                </div>
                                Ethical Data Practices
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground mb-6 text-base">
                                We take data ethics seriously. Here's how we operate responsibly:
                            </p>
                            <ul className="space-y-3">
                                {[
                                    {
                                        title: "API-first approach",
                                        desc: "We use official APIs wherever available (Ticketmaster Discovery API)."
                                    },
                                    {
                                        title: "robots.txt compliance",
                                        desc: "We respect crawling restrictions and terms of service."
                                    },
                                    {
                                        title: "Rate limiting",
                                        desc: "We implement intelligent delays and never overload source servers."
                                    },
                                    {
                                        title: "Direct attribution",
                                        desc: "We always link directly to the original ticketing source for bookings."
                                    },
                                    {
                                        title: "No personal data",
                                        desc: "We only collect publicly available event information."
                                    },
                                    {
                                        title: "No ticket sales",
                                        desc: "We don't sell tickets - all bookings go directly to official sources."
                                    },
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30 transition-all hover:shadow-sm">
                                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                        <div>
                                            <strong className="text-foreground">{item.title}:</strong>{" "}
                                            <span className="text-muted-foreground">{item.desc}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Update Frequency */}
                    <Card className="border-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-2xl">
                                <div className="rounded-lg bg-muted p-2">
                                    <Clock className="h-6 w-6 text-foreground" />
                                </div>
                                Update Frequency
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground text-base">
                                Our database is automatically updated daily via scheduled jobs. This ensures
                                you always see the latest events, accurate pricing, and up-to-date availability.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Contact */}
                    <Card className="border-2" id="contact">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-2xl">
                                <div className="rounded-lg bg-muted p-2">
                                    <Mail className="h-6 w-6 text-foreground" />
                                </div>
                                Contact
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground mb-6 text-base">
                                Have questions, feedback, or want to report an issue? Get in touch:
                            </p>
                            <div className="flex flex-wrap gap-4 mb-6">
                                <Button variant="outline" size="lg" asChild className="border-2 transition-all hover:bg-muted">
                                    <a href="mailto:your@email.com" className="flex items-center">
                                        <Mail className="h-5 w-5 mr-2" />
                                        your@email.com
                                    </a>
                                </Button>
                                <Button variant="outline" size="lg" asChild className="border-2 transition-all hover:bg-muted">
                                    <a
                                        href="https://github.com/turtur0/events-aggregator"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center"
                                    >
                                        <Github className="h-5 w-5 mr-2" />
                                        GitHub Repository
                                    </a>
                                </Button>
                            </div>
                            <div className="p-5 rounded-xl border-2 bg-muted/30">
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                    <strong className="text-foreground">Venue owners or event organizers:</strong> If you'd like your events
                                    removed from our aggregator, please contact us and we'll process your request within 48 hours.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>
        </div>
    );
}