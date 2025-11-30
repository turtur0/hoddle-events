'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { CATEGORIES } from '@/lib/constants/categories';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Label } from '@/components/ui/Label';
import {
  Filter,
  X,
  Plus,
  Minus,
  Users,
  Sparkles,
  TrendingUp,
  DollarSign,
  Calendar as CalendarIcon,
  Clock,
  ArrowUpDown,
  Tag,
  Grid3x3,
  Ticket
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { Calendar } from '@/components/ui/Calendar';
import { format, isAfter, isBefore, startOfDay, isWithinInterval } from 'date-fns';

export type SortOption =
  | 'recommended'
  | 'popular'
  | 'price-low'
  | 'price-high'
  | 'date-soon'
  | 'date-late'
  | 'recently-added';

interface SortConfig {
  value: SortOption;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAuth: boolean;
}

const SORT_OPTIONS: SortConfig[] = [
  { value: 'recommended', label: 'Recommended', icon: Sparkles, requiresAuth: true },
  { value: 'popular', label: 'Most Popular', icon: TrendingUp, requiresAuth: false },
  { value: 'price-low', label: 'Price: Low to High', icon: DollarSign, requiresAuth: false },
  { value: 'price-high', label: 'Price: High to Low', icon: DollarSign, requiresAuth: false },
  { value: 'date-soon', label: 'Date: Soonest', icon: CalendarIcon, requiresAuth: false },
  { value: 'date-late', label: 'Date: Latest', icon: CalendarIcon, requiresAuth: false },
  { value: 'recently-added', label: 'Recently Added', icon: Clock, requiresAuth: false },
];

interface EventFiltersProps {
  isAuthenticated?: boolean;
}

export function EventFilters({ isAuthenticated = false }: EventFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [showFilters, setShowFilters] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  // Get current filter values
  const category = searchParams.get('category') || 'all';
  const subcategory = searchParams.get('subcategory') || 'all';
  const dateFilter = searchParams.get('date') || 'all';
  const freeOnly = searchParams.get('free') === 'true';
  const accessibleOnly = searchParams.get('accessible') === 'true';
  const sortOption = (searchParams.get('sort') as SortOption) ||
    (isAuthenticated ? 'recommended' : 'date-soon');

  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const hasCustomDateRange = Boolean(dateFrom || dateTo);

  const selectedCategory = CATEGORIES.find(cat => cat.value === category);
  const availableSortOptions = SORT_OPTIONS.filter(
    option => !option.requiresAuth || isAuthenticated
  );

  const hasActiveFilters =
    category !== 'all' ||
    subcategory !== 'all' ||
    dateFilter !== 'all' ||
    hasCustomDateRange ||
    freeOnly ||
    accessibleOnly;

  const activeFilterCount = [
    category !== 'all',
    subcategory !== 'all',
    dateFilter !== 'all' || hasCustomDateRange,
    freeOnly,
    accessibleOnly,
  ].filter(Boolean).length;

  // Update URL with new parameter
  const updateURL = (key: string, value: string | boolean) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === 'all' || value === false) {
      params.delete(key);
    } else {
      params.set(key, value.toString());
    }

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

    params.delete('subcategory');
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleSortChange = (value: SortOption) => {
    const params = new URLSearchParams(searchParams.toString());
    const defaultSort = isAuthenticated ? 'recommended' : 'date-soon';

    if (value === defaultSort) {
      params.delete('sort');
    } else {
      params.set('sort', value);
    }

    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleDateRangeChange = (from: Date | undefined, to: Date | undefined) => {
    const params = new URLSearchParams(searchParams.toString());

    params.delete('date');

    if (from) {
      params.set('dateFrom', format(from, 'yyyy-MM-dd'));
    } else {
      params.delete('dateFrom');
    }

    if (to) {
      params.set('dateTo', format(to, 'yyyy-MM-dd'));
    } else {
      params.delete('dateTo');
    }

    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handlePresetDateChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    params.delete('dateFrom');
    params.delete('dateTo');

    if (value === 'all' || value === 'custom') {
      params.delete('date');
    } else {
      params.set('date', value);
    }

    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const clearDateFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('date');
    params.delete('dateFrom');
    params.delete('dateTo');
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const clearAllFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('category');
    params.delete('subcategory');
    params.delete('date');
    params.delete('dateFrom');
    params.delete('dateTo');
    params.delete('free');
    params.delete('accessible');
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const getDateBadgeText = () => {
    if (hasCustomDateRange) {
      const from = dateFrom ? format(new Date(dateFrom), 'dd MMM') : '';
      const to = dateTo ? format(new Date(dateTo), 'dd MMM') : '';
      if (from && to) return `${from} - ${to}`;
      if (from) return `From ${from}`;
      if (to) return `Until ${to}`;
    }
    return dateFilter.replace('-', ' ');
  };

  return (
    <div className="space-y-3">
      {/* Filter Header */}
      <div className="bg-card border-2 rounded-lg p-4 transition-all hover:border-primary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Filters & Sort</h3>
            {activeFilterCount > 0 && (
              <Badge className="bg-primary text-primary-foreground animate-in fade-in zoom-in duration-200">
                {activeFilterCount}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className="h-8 w-8 transition-all hover:bg-primary/10 hover:text-primary"
            >
              {showFilters ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </Button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-8 px-2 transition-all hover:bg-destructive/10 hover:text-destructive animate-in fade-in slide-in-from-right-2 duration-200"
              >
                <X className="h-4 w-4 mr-1" />
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Active Filter Badges */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t animate-in fade-in slide-in-from-top-2 duration-300">
            {category !== 'all' && (
              <FilterBadge
                icon={Tag}
                label={selectedCategory?.label || category}
                onRemove={() => handleCategoryChange('all')}
                variant="primary"
              />
            )}
            {subcategory !== 'all' && (
              <FilterBadge
                icon={Grid3x3}
                label={subcategory}
                onRemove={() => updateURL('subcategory', 'all')}
                variant="primary"
              />
            )}
            {(dateFilter !== 'all' || hasCustomDateRange) && (
              <FilterBadge
                icon={CalendarIcon}
                label={getDateBadgeText()}
                onRemove={clearDateFilter}
                variant="secondary"
              />
            )}
            {freeOnly && (
              <FilterBadge
                icon={Ticket}
                label="Free only"
                onRemove={() => updateURL('free', false)}
                variant="emerald"
              />
            )}
            {accessibleOnly && (
              <FilterBadge
                icon={Users}
                label="Accessible only"
                onRemove={() => updateURL('accessible', false)}
                variant="emerald"
              />
            )}
          </div>
        )}
      </div>

      {/* Filter Controls */}
      {showFilters && (
        <div className="bg-card border-2 rounded-lg p-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="space-y-4">
            {/* Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Sort By */}
              <FilterSelect
                label="Sort by"
                icon={ArrowUpDown}
                value={sortOption}
                onChange={handleSortChange}
                options={availableSortOptions.map(opt => ({
                  value: opt.value,
                  label: opt.label,
                  icon: opt.icon,
                }))}
              />

              {/* Category */}
              <FilterSelect
                label="Category"
                icon={Tag}
                value={category}
                onChange={handleCategoryChange}
                options={[
                  { value: 'all', label: 'All categories' },
                  ...CATEGORIES.map(cat => ({ value: cat.value, label: cat.label })),
                ]}
              />

              {/* Subcategory */}
              <FilterSelect
                label="Subcategory"
                icon={Grid3x3}
                value={subcategory}
                onChange={(value) => updateURL('subcategory', value)}
                disabled={category === 'all' || !selectedCategory?.subcategories?.length}
                options={[
                  { value: 'all', label: 'All types' },
                  ...(selectedCategory?.subcategories?.map(sub => ({ value: sub, label: sub })) || []),
                ]}
              />

              {/* Date Filter with Calendar */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                  Date Range
                </Label>
                <div className="flex gap-2">
                  <Select
                    value={hasCustomDateRange ? 'custom' : dateFilter}
                    onValueChange={handlePresetDateChange}
                  >
                    <SelectTrigger className="border-2 hover:border-secondary/30 transition-colors flex-1">
                      <SelectValue placeholder="Any time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="this-week">This week</SelectItem>
                      <SelectItem value="this-month">This month</SelectItem>
                      <SelectItem value="next-month">Next month</SelectItem>
                      {hasCustomDateRange && (
                        <SelectItem value="custom">Custom range</SelectItem>
                      )}
                    </SelectContent>
                  </Select>

                  <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className={`border-2 hover:border-secondary/30 transition-all hover:scale-105 ${hasCustomDateRange ? 'bg-secondary/10 border-secondary/30 scale-105' : ''
                          }`}
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[420px] p-0" align="end" side="bottom">
                      <DateRangePicker
                        dateFrom={dateFrom ? new Date(dateFrom) : undefined}
                        dateTo={dateTo ? new Date(dateTo) : undefined}
                        onDateChange={handleDateRangeChange}
                        onClose={() => setDatePopoverOpen(false)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-3">
              <FilterToggle
                id="free-only"
                label="Free only"
                icon={Ticket}
                checked={freeOnly}
                onChange={(checked) => updateURL('free', checked)}
              />
              <FilterToggle
                id="accessible-only"
                label="Accessible only"
                icon={Users}
                checked={accessibleOnly}
                onChange={(checked) => updateURL('accessible', checked)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable Components
interface FilterBadgeProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onRemove: () => void;
  variant: 'primary' | 'secondary' | 'emerald';
}

function FilterBadge({ icon: Icon, label, onRemove, variant }: FilterBadgeProps) {
  const variantStyles = {
    primary: 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20',
    secondary: 'bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/20',
    emerald: 'border-2 border-emerald-500/30 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400',
  };

  return (
    <Badge variant="secondary" className={`gap-1 transition-colors ${variantStyles[variant]}`}>
      <Icon className="h-3 w-3" />
      {label}
      <button onClick={onRemove} className="ml-1 hover:text-destructive transition-colors">
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

interface FilterSelectProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (value: any) => void;
  disabled?: boolean;
  options: Array<{
    value: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
  }>;
}

function FilterSelect({ label, icon: Icon, value, onChange, disabled, options }: FilterSelectProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="border-2 hover:border-primary/30 transition-colors disabled:opacity-50">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => {
            const OptionIcon = option.icon;
            return (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  {OptionIcon && <OptionIcon className="h-4 w-4" />}
                  <span>{option.label}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

interface FilterToggleProps {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function FilterToggle({ id, label, icon: Icon, checked, onChange }: FilterToggleProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-2 rounded-md transition-all hover:border-emerald-500/30 hover:scale-[1.02] bg-background">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-emerald-600"
      />
      <Label htmlFor={id} className="cursor-pointer text-sm">
        {label}
      </Label>
    </div>
  );
}

// Date Range Picker Component
interface DateRangePickerProps {
  dateFrom?: Date;
  dateTo?: Date;
  onDateChange: (from: Date | undefined, to: Date | undefined) => void;
  onClose: () => void;
}

function DateRangePicker({ dateFrom, dateTo, onDateChange, onClose }: DateRangePickerProps) {
  const [selectedFrom, setSelectedFrom] = useState<Date | undefined>(dateFrom);
  const [selectedTo, setSelectedTo] = useState<Date | undefined>(dateTo);
  const [hoveredDate, setHoveredDate] = useState<Date | undefined>();
  const today = startOfDay(new Date());

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;

    if (!selectedFrom && !selectedTo) {
      setSelectedFrom(date);
      return;
    }

    if (selectedFrom && !selectedTo) {
      if (isBefore(date, selectedFrom)) {
        setSelectedTo(selectedFrom);
        setSelectedFrom(date);
      } else {
        setSelectedTo(date);
      }
      return;
    }

    setSelectedFrom(date);
    setSelectedTo(undefined);
  };

  const handleApply = () => {
    onDateChange(selectedFrom, selectedTo);
    onClose();
  };

  const handleClear = () => {
    setSelectedFrom(undefined);
    setSelectedTo(undefined);
    onDateChange(undefined, undefined);
    onClose();
  };

  const isInRange = (date: Date) => {
    if (!selectedFrom) return false;

    if (selectedTo) {
      return isWithinInterval(date, { start: selectedFrom, end: selectedTo });
    }

    if (hoveredDate && isAfter(hoveredDate, selectedFrom)) {
      return isWithinInterval(date, { start: selectedFrom, end: hoveredDate });
    }

    return false;
  };

  const getInstructions = () => {
    if (!selectedFrom) return 'Select start date';
    if (!selectedTo) return 'Select end date';
    return 'Click a date to start new selection';
  };

  return (
    <div className="space-y-4 p-4 w-full">
      <div className="text-sm text-muted-foreground text-center pb-2 border-b">
        {getInstructions()}
      </div>

      <Calendar
        mode="single"
        selected={selectedFrom}
        onSelect={handleDateSelect}
        disabled={(date) => isBefore(date, today)}
        initialFocus
        className="rounded-md border-0 w-full"
        classNames={{
          months: "w-full",
          month: "w-full space-y-4",
          caption: "flex justify-center pt-1 relative items-center",
          caption_label: "text-sm font-medium",
          nav: "space-x-1 flex items-center",
          table: "w-full border-collapse",
          head_row: "flex w-full",
          head_cell: "text-muted-foreground rounded-md w-full font-normal text-[0.8rem] flex-1",
          row: "flex w-full mt-2",
          cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 flex-1",
          day: "h-9 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md",
          day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          day_today: "bg-accent text-accent-foreground",
          day_outside: "text-muted-foreground opacity-50",
          day_disabled: "text-muted-foreground opacity-50",
          day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
          day_hidden: "invisible",
          month_grid: "w-full"
        }}
        onDayMouseEnter={setHoveredDate}
        onDayMouseLeave={() => setHoveredDate(undefined)}
        modifiers={{
          range_start: selectedFrom,
          range_end: selectedTo,
          range_middle: (date) => isInRange(date) && date !== selectedFrom && date !== selectedTo,
        }}
        modifiersClassNames={{
          range_start: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-bold rounded-l-md rounded-r-none',
          range_end: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-bold rounded-r-md rounded-l-none',
          range_middle: 'bg-primary/15 hover:bg-primary/25 rounded-none transition-colors',
        }}
      />

      {(selectedFrom || selectedTo) && (
        <div className="px-3 py-3 bg-muted/50 rounded-md space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground font-medium">From:</span>
            <span className="text-sm font-semibold">
              {selectedFrom ? format(selectedFrom, 'dd MMM yyyy') : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground font-medium">To:</span>
            <span className="text-sm font-semibold">
              {selectedTo ? format(selectedTo, 'dd MMM yyyy') : '—'}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          className="flex-1 transition-all hover:scale-105"
        >
          Clear
        </Button>
        <Button
          size="sm"
          onClick={handleApply}
          disabled={!selectedFrom}
          className="flex-1 transition-all hover:scale-105 disabled:scale-100"
        >
          Apply
        </Button>
      </div>
    </div>
  );
}