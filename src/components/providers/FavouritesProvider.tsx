'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getUserFavourites } from '@/lib/actions/interactions';

interface FavouritesContextType {
    favourites: Set<string>;
    isLoading: boolean;
    isFavourited: (eventId: string) => boolean;
    updateFavourite: (eventId: string, isFavourited: boolean) => void;
}

const FavouritesContext = createContext<FavouritesContextType>({
    favourites: new Set(),
    isLoading: true,
    isFavourited: () => false,
    updateFavourite: () => { },
});

export function FavouritesProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const [favourites, setFavourites] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (session?.user?.id) {
            getUserFavourites(session.user.id).then(favs => {
                setFavourites(new Set(favs));
                setIsLoading(false);
            });
        } else {
            setFavourites(new Set());
            setIsLoading(false);
        }
    }, [session?.user?.id]);

    const isFavourited = (eventId: string) => favourites.has(eventId);

    const updateFavourite = (eventId: string, isFav: boolean) => {
        setFavourites(prev => {
            const next = new Set(prev);
            if (isFav) {
                next.add(eventId);
            } else {
                next.delete(eventId);
            }
            return next;
        });
    };

    return (
        <FavouritesContext.Provider value={{ favourites, isLoading, isFavourited, updateFavourite }}>
            {children}
        </FavouritesContext.Provider>
    );
}

export const useFavourites = () => useContext(FavouritesContext);