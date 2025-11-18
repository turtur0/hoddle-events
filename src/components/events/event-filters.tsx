'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { CATEGORIES } from '@/app/lib/categories';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Filter, X, Plus, Minus } from 'lucide-react';
import { useState } from 'react';

export function EventFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [showFilters, setShowFilters] = useState(false);

  const category = searchParams.get('category') || 'all';
  const subcategory = searchParams.get('subcategory') || 'all';
  const dateFilter = searchParams.get('date') || 'all';
  const freeOnly = searchParams.get('free') === 'true';

  const updateURL = (key: string, value: string | boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value === 'all' || value === false) {
      params.delete(key);
    } else {
      params.set(key, value.toString());
    }
    
    // Reset to page 1 when filters change
    params.set('page', '1');
    
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleCategoryChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value === 'all') {
      params.delete('category');
    } else {
      params.set('category', value);
    }
    
    // Clear subcategory when category changes
    params.delete('subcategory');
    params.set('page', '1');
    
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const clearAllFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('category');
    params.delete('subcategory');
    params.delete('date');
    params.delete('free');
    params.set('page', '1');

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const hasActiveFilters =
    category !== 'all' || subcategory !== 'all' || dateFilter !== 'all' || freeOnly;

  const selectedCategory = CATEGORIES.find(cat => cat.value === category);

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Filters</h3>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className="h-8 w-8"
          >
            {showFilters ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 px-2"
            >
              <X className="h-4 w-4 mr-1" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Subcategory</Label>
            <Select
              value={subcategory}
              onValueChange={(value) => updateURL('subcategory', value)}
              disabled={category === 'all' || !selectedCategory?.subcategories?.length}
            >
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {selectedCategory?.subcategories?.map((sub) => (
                  <SelectItem key={sub} value={sub}>
                    {sub}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <Select value={dateFilter} onValueChange={(value) => updateURL('date', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Any time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this-week">This week</SelectItem>
                <SelectItem value="this-month">This month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Price</Label>
            <div className="flex items-center space-x-2 h-10">
              <Switch
                id="free-only"
                checked={freeOnly}
                onCheckedChange={(checked) => updateURL('free', checked)}
              />
              <Label htmlFor="free-only" className="cursor-pointer">
                Free events only
              </Label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}