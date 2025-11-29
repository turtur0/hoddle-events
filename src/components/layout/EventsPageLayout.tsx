// components/layout/EventsPageLayout.tsx
import { ReactNode } from 'react';
import { BackButton } from '@/components/navigation/BackButton';
import { Badge } from '@/components/ui/Badge';
import { LucideIcon } from 'lucide-react';

interface EventsPageLayoutProps {
    icon: LucideIcon;
    iconColor?: string;
    iconBgColor?: string;
    title: string;
    description: string;
    badge?: {
        text: string;
        className?: string;
    };
    filters?: ReactNode;
    children: ReactNode;
}

export function EventsPageLayout({
    icon: Icon,
    iconColor = 'text-primary',
    iconBgColor = 'bg-primary/10',
    title,
    description,
    badge,
    filters,
    children,
}: EventsPageLayoutProps) {
    return (
        <div className="w-full">
            {/* Header Section */}
            <section className="page-header">
                <div className="container-page">
                    <BackButton fallbackUrl="/" className="mb-8" />

                    <div className="flex items-start justify-between flex-wrap gap-6">
                        <div className="flex items-start gap-4 flex-1">
                            <div className={`icon-container ${iconBgColor}`}>
                                <Icon className={`h-8 w-8 ${iconColor}`} />
                            </div>
                            <div>
                                <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-2">
                                    {title}
                                </h1>
                                <p className="text-lg text-muted-foreground">
                                    {description}
                                </p>
                            </div>
                        </div>
                        {badge && (
                            <Badge
                                variant="secondary"
                                className={badge.className || 'text-base px-4 py-2'}
                            >
                                {badge.text}
                            </Badge>
                        )}
                    </div>
                </div>
            </section>

            {/* Filters Section */}
            {filters && (
                <section className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
                    <div className="container-page py-6">
                        {filters}
                    </div>
                </section>
            )}

            {/* Content Section */}
            <section className="container-page section-spacing animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                {children}
            </section>
        </div>
    );
}