'use client';

import { trackClickthrough } from '@/lib/actions/interactions';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

interface BookingLinkProps {
    eventId: string;
    href: string;
    children?: React.ReactNode;
    className?: string;
    variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
    size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function BookingLink({
    eventId,
    href,
    children,
    className,
    variant = 'default',
    size = 'lg'
}: BookingLinkProps) {
    const handleClick = () => {
        trackClickthrough(eventId, 'direct');
    };

    return (
        <Button asChild className={className} size={size} variant={variant} onClick={handleClick}>
            <a href={href} target="_blank" rel="noopener noreferrer">
                {children || 'Get Tickets'}
                <ExternalLink className="h-4 w-4 ml-2" />
            </a>
        </Button>
    );
}