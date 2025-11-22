'use client';

import { useEffect, useRef } from 'react';
import { trackView } from '@/actions/interactions';

interface ViewTrackerProps {
    eventId: string;
    source?: 'search' | 'recommendation' | 'category_browse' | 'homepage' | 'direct' | 'similar_events';
}

export function ViewTracker({ eventId, source = 'direct' }: ViewTrackerProps) {
    const tracked = useRef(false);

    useEffect(() => {
        if (!tracked.current) {
            tracked.current = true;
            trackView(eventId, source);
        }
    }, [eventId, source]);

    return null;
}