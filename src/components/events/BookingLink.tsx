'use client';

import { trackClickthrough } from '@/lib/actions/interactions';
import { Button } from '@/components/ui/Button';
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
        <Button
            asChild
            className={`${className} group transition-all duration-200`}
            size={size}
            variant={variant}
            onClick={handleClick}
        >
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center"
            >
                {children || 'Get Tickets'}
                <ExternalLink className="h-4 w-4 ml-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
        </Button>
    );
}