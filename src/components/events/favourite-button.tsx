'use client';

import { useState, useTransition } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toggleFavourite } from '@/lib/actions/interactions';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface FavouriteButtonProps {
    eventId: string;
    initialFavourited?: boolean;
    source?: 'search' | 'recommendation' | 'category_browse' | 'homepage' | 'direct' | 'similar_events';
    variant?: 'icon' | 'button';
    className?: string;
}

export function FavouriteButton({
    eventId,
    initialFavourited = false,
    source = 'direct',
    variant = 'icon',
    className
}: FavouriteButtonProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const [isFavourited, setIsFavourited] = useState(initialFavourited);
    const [isPending, startTransition] = useTransition();

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!session?.user) {
            router.push('/auth/signin?callbackUrl=' + encodeURIComponent(window.location.pathname));
            return;
        }

        // Optimistic update
        setIsFavourited(!isFavourited);

        startTransition(async () => {
            const result = await toggleFavourite(eventId, source);

            if (!result.success) {
                // Revert on failure
                setIsFavourited(isFavourited);
            } else {
                setIsFavourited(result.isFavourited);
            }
        });
    };

    if (variant === 'button') {
        return (
            <Button
                variant={isFavourited ? 'default' : 'outline'}
                size="sm"
                onClick={handleClick}
                disabled={isPending}
                className={className}
            >
                <Heart
                    className={cn(
                        'h-4 w-4 mr-2 transition-all',
                        isFavourited && 'fill-current'
                    )}
                />
                {isFavourited ? 'Saved' : 'Save'}
            </Button>
        );
    }

    return (
        <button
            onClick={handleClick}
            disabled={isPending}
            className={cn(
                'p-2 rounded-full transition-all hover:scale-110',
                'bg-black/50 hover:bg-black/70',
                isPending && 'opacity-50',
                className
            )}
            aria-label={isFavourited ? 'Remove from favourites' : 'Add to favourites'}
        >
            <Heart
                className={cn(
                    'h-5 w-5 transition-all',
                    isFavourited ? 'fill-red-500 text-red-500' : 'text-white'
                )}
            />
        </button>
    );
}