'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { CATEGORIES } from '@/lib/categories';
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
import { Filter, X, Plus, Minus, Users } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

export function EventFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [showFilters, setShowFilters] = useState(false);

  const category = searchParams.get('category') || 'all';
  const subcategory = searchParams.get('subcategory') || 'all';
  const dateFilter = searchParams.get('date') || 'all';
  const freeOnly = searchParams.get('free') === 'true';
  const accessibleOnly = searchParams.get('accessible') === 'true';

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
    params.delete('accessible');
    params.set('page', '1');

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const hasActiveFilters =
    category !== 'all' || 
    subcategory !== 'all' || 
    dateFilter !== 'all' || 
    freeOnly || 
    accessibleOnly;

  const selectedCategory = CATEGORIES.find(cat => cat.value === category);

  // Count active filters
  const activeFilterCount = [
    category !== 'all',
    subcategory !== 'all',
    dateFilter !== 'all',
    freeOnly,
    accessibleOnly,
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Filter Header */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Filters</h3>
            {activeFilterCount > 0 && (
              <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                {activeFilterCount}
              </span>
            )}
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

        {/* Active Filter Badges */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
            {category !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Category: {selectedCategory?.label}
                <button
                  onClick={() => handleCategoryChange('all')}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {subcategory !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Type: {subcategory}
                <button
                  onClick={() => updateURL('subcategory', 'all')}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {dateFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Date: {dateFilter.replace('-', ' ')}
                <button
                  onClick={() => updateURL('date', 'all')}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {freeOnly && (
              <Badge variant="secondary" className="gap-1">
                Free only
                <button
                  onClick={() => updateURL('free', false)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {accessibleOnly && (
              <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                <Users className="h-3 w-3" />
                Accessible only
                <button
                  onClick={() => updateURL('accessible', false)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Filter Controls */}
      {showFilters && (
        <div className="bg-card border rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Category */}
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

            {/* Subcategory */}
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

            {/* Date */}
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
                  <SelectItem value="next-month">Next month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Filter */}
            <div className="space-y-2">
              <Label>Price</Label>
              <div className="flex items-center space-x-2 h-10">
                <Switch
                  id="free-only"
                  checked={freeOnly}
                  onCheckedChange={(checked) => updateURL('free', checked)}
                />
                <Label htmlFor="free-only" className="cursor-pointer text-sm">
                  Free only
                </Label>
              </div>
            </div>

            {/* Accessibility Filter */}
            <div className="space-y-2">
              <Label>Accessibility</Label>
              <div className="flex items-center space-x-2 h-10">
                <Switch
                  id="accessible-only"
                  checked={accessibleOnly}
                  onCheckedChange={(checked) => updateURL('accessible', checked)}
                />
                <Label htmlFor="accessible-only" className="cursor-pointer text-sm flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Accessible
                </Label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}