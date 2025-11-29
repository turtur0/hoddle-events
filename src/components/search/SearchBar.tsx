// components/search/SearchBar.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface SearchBarProps {
  placeholder?: string;
}

export function SearchBar({
  placeholder = "Search events by name, venue, or description..."
}: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [isSearching, setIsSearching] = useState(false);

  const isHomePage = pathname === '/';

  // Sync input with URL when user navigates (back/forward button)
  useEffect(() => {
    const urlQuery = searchParams.get('q') || '';
    if (urlQuery !== searchTerm) {
      setSearchTerm(urlQuery);
    }
  }, [searchParams.get('q')]);

  // Debounced search - only runs when searchTerm changes
  useEffect(() => {
    if (isHomePage) {
      setIsSearching(false);
      return;
    }

    const urlQuery = searchParams.get('q') || '';

    if (searchTerm === urlQuery) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (searchTerm.trim()) {
        params.set('q', searchTerm.trim());
      } else {
        params.delete('q');
      }

      params.set('page', '1');

      router.push(`${pathname}?${params.toString()}`, { scroll: false });
      setIsSearching(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, isHomePage, pathname, searchParams, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchTerm.trim()) return;

    const params = new URLSearchParams();
    params.set('q', searchTerm.trim());
    params.set('page', '1');

    if (isHomePage) {
      router.push(`/events?${params.toString()}`);
    } else {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  const handleClear = () => {
    setSearchTerm('');

    if (!isHomePage) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('q');
      params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative group">
      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors duration-[var(--transition-base)] ${isHomePage ? 'group-focus-within:text-primary' : 'group-focus-within:text-foreground'
        }`} />
      <Input
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className={`pl-9 transition-all duration-[var(--transition-base)] ${isHomePage
            ? 'pr-20 h-14 text-base border-2 focus:border-primary/50 focus:ring-2 focus:ring-primary/20'
            : 'pr-9 border-2'
          }`}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {isSearching && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {searchTerm && !isSearching && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-7 w-7 p-0 hover:bg-muted/80 transition-colors duration-[var(--transition-base)]"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear search</span>
          </Button>
        )}
        {isHomePage && (
          <Button
            type="submit"
            size="sm"
            className={`h-9 px-4 transition-all hover:scale-[1.02] active:scale-[0.98] ${searchTerm.trim() ? 'animate-in fade-in-0 slide-in-from-right-2 duration-200' : ''
              }`}
          >
            Search
          </Button>
        )}
      </div>
    </form>
  );
}