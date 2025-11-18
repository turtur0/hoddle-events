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

  // Sync input with URL when user navigates (back/forward button)
  useEffect(() => {
    const urlQuery = searchParams.get('q') || '';
    if (urlQuery !== searchTerm) {
      setSearchTerm(urlQuery);
    }
  }, [searchParams.get('q')]); // Only depend on the 'q' param, not all searchParams

  // Debounced search - only runs when searchTerm changes
  useEffect(() => {
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
      
      // Only reset to page 1 when search term changes
      params.set('page', '1');
      
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
      setIsSearching(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]); // Only depend on searchTerm

  const handleClear = () => {
    setSearchTerm('');
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search events by name, venue, or description..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="pl-9 pr-9"
      />
      {isSearching ? (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      ) : searchTerm ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Clear search</span>
        </Button>
      ) : null}
    </div>
  );
}