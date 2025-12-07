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
  placeholder = "Search events by name, venue or description..."
}: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [isSearching, setIsSearching] = useState(false);
  const [truncatedPlaceholder, setTruncatedPlaceholder] = useState(placeholder);

  const isHomePage = pathname === '/';

  // Handle responsive placeholder truncation
  useEffect(() => {
    const updatePlaceholder = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setTruncatedPlaceholder(placeholder.slice(0, 20) + '...');
      } else if (width < 768) {
        setTruncatedPlaceholder(placeholder.slice(0, 30) + '...');
      } else {
        setTruncatedPlaceholder(placeholder);
      }
    };

    updatePlaceholder();
    window.addEventListener('resize', updatePlaceholder);
    return () => window.removeEventListener('resize', updatePlaceholder);
  }, [placeholder]);

  // Sync input with URL when navigating
  useEffect(() => {
    const urlQuery = searchParams.get('q') || '';
    if (urlQuery !== searchTerm) {
      setSearchTerm(urlQuery);
    }
  }, [searchParams]);

  // Debounced search for non-home pages
  useEffect(() => {
    if (isHomePage || searchTerm === (searchParams.get('q') || '')) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      searchTerm.trim() ? params.set('q', searchTerm.trim()) : params.delete('q');
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
    router.push(isHomePage ? `/events?${params.toString()}` : `${pathname}?${params.toString()}`, { scroll: false });
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
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary"
        aria-hidden="true"
      />

      <Input
        type="text"
        placeholder={truncatedPlaceholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="pl-9 pr-20 sm:pr-24 h-12 sm:h-14 text-sm sm:text-base border-2 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
        aria-label="Search events"
      />

      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {isSearching && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Searching" />
        )}

        {searchTerm && !isSearching && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-7 w-7 p-0 hover:bg-muted/80 transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <Button
          type="submit"
          size="sm"
          disabled={!searchTerm.trim()}
          className="h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Search"
        >
          Search
        </Button>
      </div>
    </form>
  );
}