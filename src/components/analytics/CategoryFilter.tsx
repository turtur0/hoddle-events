// components/analytics/CategoryFilter.tsx
'use client';

import { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { CATEGORIES } from '@/lib/constants/categories';

// Updated to match global.css color scheme
export const CATEGORY_COLORS: Record<string, string> = {
    music: 'rgb(234 88 12)',      // orange-600
    theatre: 'rgb(244 63 94)',    // rose-600
    sports: 'rgb(20 184 166)',    // teal-600
    arts: 'rgb(168 85 247)',      // purple-600
    family: 'rgb(16 185 129)',    // emerald-600
    other: 'rgb(14 165 233)'      // sky-600
};

interface CategoryFilterProps {
    selectedCategories: string[];
    onCategoryToggle: (category: string) => void;
    onClear: () => void;
    showSubcategories?: boolean;
}

export function CategoryFilter({
    selectedCategories,
    onCategoryToggle,
    onClear,
    showSubcategories = false
}: CategoryFilterProps) {
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const toggleDropdown = (categoryValue: string) => {
        setOpenDropdown(openDropdown === categoryValue ? null : categoryValue);
    };

    const handleCategoryClick = (categoryValue: string) => {
        onCategoryToggle(categoryValue);
        if (!showSubcategories) {
            setOpenDropdown(null);
        }
    };

    const handleSubcategoryClick = (subcategory: string) => {
        onCategoryToggle(subcategory);
    };

    const handleBackdropClick = () => {
        setOpenDropdown(null);
    };

    // Get badge classes matching global.css
    const getBadgeClasses = (categoryValue: string) => {
        const colorMap: Record<string, string> = {
            music: 'border-2 border-orange-500/30 bg-orange-500/5 text-orange-600 hover:bg-orange-500/10 hover:border-orange-500/50 dark:text-orange-400 dark:bg-orange-400/10 dark:hover:bg-orange-400/15 dark:border-orange-400/20',
            theatre: 'border-2 border-rose-500/30 bg-rose-500/5 text-rose-600 hover:bg-rose-500/10 hover:border-rose-500/50 dark:text-rose-400 dark:bg-rose-400/10 dark:hover:bg-rose-400/15 dark:border-rose-400/20',
            sports: 'border-2 border-teal-500/30 bg-teal-500/5 text-teal-600 hover:bg-teal-500/10 hover:border-teal-500/50 dark:text-teal-400 dark:bg-teal-400/10 dark:hover:bg-teal-400/15 dark:border-teal-400/20',
            arts: 'border-2 border-purple-500/30 bg-purple-500/5 text-purple-600 hover:bg-purple-500/10 hover:border-purple-500/50 dark:text-purple-400 dark:bg-purple-400/10 dark:hover:bg-purple-400/15 dark:border-purple-400/20',
            family: 'border-2 border-emerald-500/30 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/10 hover:border-emerald-500/50 dark:text-emerald-400 dark:bg-emerald-400/10 dark:hover:bg-emerald-400/15 dark:border-emerald-400/20',
            other: 'border-2 border-sky-500/30 bg-sky-500/5 text-sky-600 hover:bg-sky-500/10 hover:border-sky-500/50 dark:text-sky-400 dark:bg-sky-400/10 dark:hover:bg-sky-400/15 dark:border-sky-400/20',
        };
        return colorMap[categoryValue] || 'border-2 border-border/50 bg-background hover:bg-muted';
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">
                    Filter by Category
                </h3>
                {selectedCategories.length > 0 && (
                    <button
                        onClick={onClear}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                        <X className="h-3 w-3" />
                        Clear
                    </button>
                )}
            </div>

            <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => {
                    const isSelected = selectedCategories.includes(cat.value);
                    const hasSubcategories = showSubcategories && cat.subcategories && cat.subcategories.length > 0;
                    const isOpen = openDropdown === cat.value;

                    return (
                        <div key={cat.value} className="relative">
                            <button
                                onClick={() => {
                                    if (hasSubcategories) {
                                        toggleDropdown(cat.value);
                                    } else {
                                        handleCategoryClick(cat.value);
                                    }
                                }}
                                className={`
                                    px-3 py-1.5 rounded-lg text-sm font-medium 
                                    transition-all flex items-center gap-1.5
                                    ${isSelected ? getBadgeClasses(cat.value) : 'border-2 border-border/50 bg-background hover:bg-muted'}
                                `}
                            >
                                {cat.label}
                                {hasSubcategories && (
                                    <ChevronDown
                                        className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                    />
                                )}
                            </button>

                            {/* Subcategory Dropdown */}
                            {hasSubcategories && isOpen && (
                                <>
                                    {/* Backdrop */}
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={handleBackdropClick}
                                    />

                                    {/* Dropdown Menu */}
                                    <div className="absolute top-full left-0 mt-1 z-20 min-w-[180px] bg-background border-2 rounded-lg shadow-lg py-1 max-h-[300px] overflow-y-auto">
                                        <div className="px-3 py-2 border-b">
                                            <button
                                                onClick={() => {
                                                    handleCategoryClick(cat.value);
                                                }}
                                                className={`
                                                    text-xs font-medium transition-colors
                                                    ${isSelected ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}
                                                `}
                                            >
                                                {isSelected ? '✓ ' : ''}All {cat.label}
                                            </button>
                                        </div>
                                        {cat.subcategories?.map(sub => {
                                            const isSubSelected = selectedCategories.includes(sub);
                                            return (
                                                <button
                                                    key={sub}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSubcategoryClick(sub);
                                                    }}
                                                    className={`
                                                        w-full px-3 py-2 text-left text-xs transition-colors flex items-center gap-2
                                                        ${isSubSelected
                                                            ? 'bg-primary/10 text-primary font-medium'
                                                            : 'hover:bg-muted'
                                                        }
                                                    `}
                                                >
                                                    <div className={`
                                                        w-3.5 h-3.5 rounded border-2 flex items-center justify-center
                                                        ${isSubSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}
                                                    `}>
                                                        {isSubSelected && (
                                                            <svg className="w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                                                                <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    {sub}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Selected Subcategories Display */}
            {selectedCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedCategories.map(cat => {
                        // Check if it's a subcategory
                        const isSubcategory = CATEGORIES.some(c =>
                            c.subcategories?.includes(cat)
                        );

                        if (isSubcategory) {
                            return (
                                <span
                                    key={cat}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded border border-primary/20"
                                >
                                    {cat}
                                    <button
                                        onClick={() => onCategoryToggle(cat)}
                                        className="hover:text-primary/70 transition-colors"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            );
                        }
                        return null;
                    })}
                </div>
            )}
        </div>
    );
}