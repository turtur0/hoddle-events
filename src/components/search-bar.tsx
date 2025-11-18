'use client';

import { useState, useEffect, useCallback } from 'react';
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

  const updateSearchParams = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value.trim()) {
      params.set('q', value.trim());
      params.set('page', '1');
    } else {
      params.delete('q');
    }
    
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    setIsSearching(false);
  }, [searchParams, pathname, router]);

  useEffect(() => {
    if (searchTerm !== (searchParams.get('q') || '')) {
      setIsSearching(true);
    }

    const timer = setTimeout(() => {
      updateSearchParams(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, updateSearchParams, searchParams]);

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