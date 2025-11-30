// components/events/EventSection.tsx
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface EventSectionProps {
    title: string;
    description?: string;
    icon: React.ReactNode;
    viewAllHref?: string;
    viewAllText?: string;
    borderClass?: string;
    gradientClass?: string;
    children?: React.ReactNode;
    isEmpty?: boolean;
    emptyMessage?: string;
}

export function EventSection({
    title,
    description,
    icon,
    viewAllHref,
    viewAllText = 'View all',
    borderClass = 'border-primary/20',
    gradientClass = 'from-primary/5',
    children,
    isEmpty = false,
    emptyMessage = 'No events available at the moment.',
}: EventSectionProps) {
    return (
        <Card className={`border-2 ${borderClass} bg-linear-to-br ${gradientClass} via-transparent to-transparent shadow-sm hover:shadow-md hover:border-opacity-50 transition-all`}>
            <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <CardTitle className="flex items-center gap-2 text-2xl mb-2">
                            {icon}
                            {title}
                        </CardTitle>
                        {description && (
                            <p className="text-sm text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>
                    {viewAllHref && !isEmpty && (
                        <Button
                            variant="outline"
                            asChild
                            className={`border-2 ${borderClass} hover:border-opacity-70 hover:bg-opacity-10 transition-all hover-lift group`}
                        >
                            <Link href={viewAllHref} className="flex items-center">
                                {viewAllText}
                                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {isEmpty ? (
                    <div className="text-center py-8">
                        <p className="text-muted-foreground">{emptyMessage}</p>
                    </div>
                ) : (
                    children
                )}
            </CardContent>
        </Card>
    );
}