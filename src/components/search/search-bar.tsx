'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [isSearching, setIsSearching] = useState(false);

  // Check if we're on the homepage
  const isHomePage = pathname === '/';

  // Sync input with URL when user navigates (back/forward button)
  useEffect(() => {
    const urlQuery = searchParams.get('q') || '';
    if (urlQuery !== searchTerm) {
      setSearchTerm(urlQuery);
    }
  }, [searchParams.get('q')]);

  // Debounced search - only runs when searchTerm changes
  // Skip auto-search on homepage (uses form submit instead)
  useEffect(() => {
    // Don't auto-search on homepage
    if (isHomePage) {
      setIsSearching(false);
      return;
    }

    const urlQuery = searchParams.get('q') || '';
    
    // Don't update if it matches what's already in URL
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
  }, [searchTerm, isHomePage]);

  // Handle form submit (for homepage redirect and Enter key)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchTerm.trim()) return;

    const params = new URLSearchParams();
    params.set('q', searchTerm.trim());
    params.set('page', '1');

    // Always redirect to /events when submitting from homepage
    if (isHomePage) {
      router.push(`/events?${params.toString()}`);
    } else {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  const handleClear = () => {
    setSearchTerm('');
    
    // If not on homepage, also clear the URL
    if (!isHomePage) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('q');
      params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search events by name, venue, or description..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className={`pl-9 ${isHomePage ? 'pr-20 h-12 text-base' : 'pr-9'}`}
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
            className="h-7 w-7 p-0"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear search</span>
          </Button>
        )}
        {/* Show search button on homepage */}
        {isHomePage && (
          <Button type="submit" size="sm" className="h-8">
            Search
          </Button>
        )}
      </div>
    </form>
  );
}