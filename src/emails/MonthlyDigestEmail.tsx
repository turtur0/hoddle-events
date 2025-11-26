// emails/MonthlyDigestEmail.tsx - FIXED VERSION
import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Text,
    Button,
} from '@react-email/components';
import * as React from 'react';

interface Event {
    _id: string;
    title: string;
    startDate: string;
    venue: { name: string };
    priceMin?: number;
    priceMax?: number;
    isFree: boolean;
    imageUrl?: string;
    category: string;
}

interface MonthlyDigestEmailProps {
    userName: string;
    keywordMatches: Event[];
    updatedFavorites: Event[];
    recommendations: { category: string; events: Event[] }[];
    unsubscribeUrl: string;
    preferencesUrl: string;
}

export default function MonthlyDigestEmail({
    userName = 'there',
    keywordMatches = [],
    updatedFavorites = [],
    recommendations = [],
    unsubscribeUrl = '',
    preferencesUrl = '',
}: MonthlyDigestEmailProps) {
    const hasContent = keywordMatches.length > 0 ||
        updatedFavorites.length > 0 ||
        recommendations.length > 0;

    const totalEvents = keywordMatches.length +
        updatedFavorites.length +
        recommendations.reduce((sum, cat) => sum + cat.events.length, 0);

    return (
        <Html>
            <Head />
            <Preview>
                {hasContent
                    ? `${totalEvents} curated events for you this month`
                    : 'Your monthly event digest'}
            </Preview>
            <Body style={main}>
                <Container style={container}>
                    {/* Header */}
                    <Section style={header}>
                        <Heading style={h1}>Melbourne Events</Heading>
                        <Text style={headerSubtext}>Your Monthly Digest</Text>
                    </Section>

                    {/* Greeting */}
                    <Section style={section}>
                        <Text style={greeting}>Hi {userName},</Text>
                        {hasContent ? (
                            <Text style={intro}>
                                We've curated {totalEvents} events based on your preferences and interests.
                                Here's what's coming up this month.
                            </Text>
                        ) : (
                            <Text style={intro}>
                                We haven't found any new events matching your preferences this month.
                                Check back soon—we're always adding new events!
                            </Text>
                        )}
                    </Section>

                    {!hasContent ? (
                        <Section style={section}>
                            <Button style={button} href={preferencesUrl}>
                                Update Your Preferences
                            </Button>
                        </Section>
                    ) : (
                        <>
                            {/* Section 1: Keyword Matches */}
                            {keywordMatches.length > 0 && (
                                <>
                                    <Section style={section}>
                                        <Heading style={h2}>Events Matching Your Keywords</Heading>
                                        <Text style={sectionSubtext}>
                                            You asked to be notified about these
                                        </Text>
                                    </Section>
                                    {keywordMatches.map((event) => (
                                        <EventCard key={event._id} event={event} />
                                    ))}
                                    <Hr style={divider} />
                                </>
                            )}

                            {/* Section 2: Updated Favorites */}
                            {updatedFavorites.length > 0 && (
                                <>
                                    <Section style={section}>
                                        <Heading style={h2}>Updates to Your Saved Events</Heading>
                                        <Text style={sectionSubtext}>
                                            Changes to events you've favorited
                                        </Text>
                                    </Section>
                                    {updatedFavorites.map((event) => (
                                        <EventCard key={event._id} event={event} />
                                    ))}
                                    <Hr style={divider} />
                                </>
                            )}

                            {/* Section 3: Personalized Recommendations */}
                            {recommendations.map((categoryGroup, idx) => (
                                <React.Fragment key={categoryGroup.category}>
                                    <Section style={section}>
                                        <Heading style={h2}>
                                            {getCategoryLabel(categoryGroup.category)} Recommendations
                                        </Heading>
                                        <Text style={sectionSubtext}>
                                            Curated picks based on your interests
                                        </Text>
                                    </Section>
                                    {categoryGroup.events.map((event) => (
                                        <EventCard key={event._id} event={event} />
                                    ))}
                                    {idx < recommendations.length - 1 && <Hr style={divider} />}
                                </React.Fragment>
                            ))}
                        </>
                    )}

                    {/* Footer */}
                    <Hr style={footerDivider} />
                    <Section style={footer}>
                        <Text style={footerText}>
                            Want to customize what you receive?{' '}
                            <Link href={preferencesUrl} style={footerLink}>
                                Update your preferences
                            </Link>
                        </Text>
                        <Text style={footerText}>
                            <Link href={unsubscribeUrl} style={unsubscribeLink}>
                                Unsubscribe from monthly emails
                            </Link>
                        </Text>
                        <Text style={footerCopyright}>
                            © {new Date().getFullYear()} Melbourne Events. All rights reserved.
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
}

// Event Card Component
function EventCard({ event }: { event: Event }) {
    const eventUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/events/${event._id}`;

    const date = new Date(event.startDate);
    const formattedDate = date.toLocaleDateString('en-AU', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

    const formattedTime = date.toLocaleTimeString('en-AU', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });

    // FIXED: Better price formatting with proper undefined handling
    const getPriceDisplay = () => {
        if (event.isFree) {
            return 'Free';
        }

        if (event.priceMin !== undefined && event.priceMax !== undefined) {
            if (event.priceMin === event.priceMax) {
                return `$${event.priceMin.toFixed(2)}`;
            }
            return `$${event.priceMin.toFixed(2)} - $${event.priceMax.toFixed(2)}`;
        }

        if (event.priceMin !== undefined) {
            return `From $${event.priceMin.toFixed(2)}`;
        }

        // If no price info available
        return 'See website for pricing';
    };

    // FIXED: Only render image if URL exists and is valid
    const hasValidImage = event.imageUrl &&
        event.imageUrl.startsWith('http') &&
        !event.imageUrl.includes('placeholder');

    return (
        <Section style={eventCard}>
            <table width="100%" cellPadding="0" cellSpacing="0">
                <tr>
                    {hasValidImage && (
                        <td style={eventImageCell}>
                            <Img
                                src={event.imageUrl}
                                width="100"
                                height="100"
                                alt={event.title}
                                style={eventImage}
                            />
                        </td>
                    )}
                    <td style={eventDetails}>
                        <Link href={eventUrl} style={eventTitle}>
                            {event.title}
                        </Link>
                        <Text style={eventMeta}>
                            <span style={metaLabel}>Date:</span> {formattedDate} at {formattedTime}
                        </Text>
                        <Text style={eventMeta}>
                            <span style={metaLabel}>Venue:</span> {event.venue.name}
                        </Text>
                        <Text style={eventMeta}>
                            <span style={metaLabel}>Price:</span> {getPriceDisplay()}
                        </Text>
                        <Button style={eventButton} href={eventUrl}>
                            View Details
                        </Button>
                    </td>
                </tr>
            </table>
        </Section>
    );
}

// Helper Functions
function getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
        music: 'Music',
        theatre: 'Theatre',
        sports: 'Sports',
        arts: 'Arts & Culture',
        family: 'Family',
        other: 'Other',
    };
    return labels[category.toLowerCase()] || category;
}

// Styles
const main = {
    backgroundColor: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const container = {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    marginBottom: '40px',
    maxWidth: '600px',
    borderRadius: '8px',
    overflow: 'hidden' as const,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
};

const header = {
    backgroundColor: '#2563eb',
    padding: '32px 24px',
    textAlign: 'center' as const,
};

const h1 = {
    color: '#ffffff',
    fontSize: '28px',
    fontWeight: '700',
    margin: '0 0 8px 0',
    letterSpacing: '-0.5px',
};

const headerSubtext = {
    color: '#dbeafe',
    fontSize: '14px',
    fontWeight: '500',
    margin: '0',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
};

const section = {
    padding: '24px 24px 0 24px',
};

const greeting = {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 12px 0',
};

const intro = {
    fontSize: '15px',
    lineHeight: '24px',
    color: '#4b5563',
    margin: '0',
};

const h2 = {
    fontSize: '20px',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 8px 0',
    letterSpacing: '-0.3px',
};

const sectionSubtext = {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 0 16px 0',
};

const eventCard = {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    margin: '0 24px 16px 24px',
    padding: '16px',
};

const eventImageCell = {
    width: '100px',
    verticalAlign: 'top' as const,
    paddingRight: '16px',
};

const eventImage = {
    borderRadius: '6px',
    objectFit: 'cover' as const,
    display: 'block',
};

const eventDetails = {
    verticalAlign: 'top' as const,
};

const eventTitle = {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827',
    textDecoration: 'none',
    display: 'block',
    marginBottom: '8px',
    lineHeight: '22px',
};

const eventMeta = {
    fontSize: '14px',
    lineHeight: '20px',
    color: '#4b5563',
    margin: '4px 0',
};

const metaLabel = {
    fontWeight: '500',
    color: '#6b7280',
};

const eventButton = {
    backgroundColor: '#2563eb',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'inline-block',
    padding: '10px 20px',
    marginTop: '12px',
    border: 'none',
    cursor: 'pointer',
};

const button = {
    backgroundColor: '#2563eb',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'inline-block',
    padding: '12px 24px',
    marginTop: '8px',
};

const divider = {
    borderColor: '#e5e7eb',
    margin: '24px 24px',
};

const footerDivider = {
    borderColor: '#e5e7eb',
    margin: '32px 24px 24px 24px',
};

const footer = {
    padding: '0 24px 32px 24px',
};

const footerText = {
    fontSize: '13px',
    lineHeight: '20px',
    color: '#6b7280',
    margin: '8px 0',
    textAlign: 'center' as const,
};

const footerLink = {
    color: '#2563eb',
    textDecoration: 'underline',
    fontWeight: '500',
};

const unsubscribeLink = {
    color: '#9ca3af',
    textDecoration: 'underline',
};

const footerCopyright = {
    fontSize: '12px',
    color: '#9ca3af',
    margin: '16px 0 0 0',
    textAlign: 'center' as const,
};