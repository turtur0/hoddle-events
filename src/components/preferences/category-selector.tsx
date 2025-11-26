'use client';

import { Check } from 'lucide-react';
import { CATEGORIES } from '@/lib/constants/categories';

interface CategorySelectorProps {
    selectedCategories: Set<string>;
    selectedSubcategories: Set<string>;
    onCategoryToggle: (category: string) => void;
    onSubcategoryToggle: (subcategory: string) => void;
    showSubcategories?: boolean;
    variant?: 'default' | 'compact';
}

export function CategorySelector({
    selectedCategories,
    selectedSubcategories,
    onCategoryToggle,
    onSubcategoryToggle,
    showSubcategories = true,
    variant = 'default',
}: CategorySelectorProps) {
    return (
        <div className="space-y-6">
            {/* Main Categories */}
            <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((category) => (
                    <button
                        key={category.value}
                        onClick={() => onCategoryToggle(category.value)}
                        className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${selectedCategories.has(category.value)
                                ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20'
                                : 'bg-muted hover:bg-muted/80'
                            }
            `}
                    >
                        {selectedCategories.has(category.value) && (
                            <Check className="inline-block w-4 h-4 mr-1.5 -ml-0.5" />
                        )}
                        {category.label}
                    </button>
                ))}
            </div>

            {/* Subcategories */}
            {showSubcategories && selectedCategories.size > 0 && (
                <div className="space-y-4 pt-4 border-t">
                    {variant === 'default' && (
                        <h3 className="text-sm font-semibold text-muted-foreground">
                            Refine your interests (optional)
                        </h3>
                    )}

                    {CATEGORIES.filter((cat) => selectedCategories.has(cat.value)).map((category) => (
                        <div key={category.value} className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">
                                {category.label}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {category.subcategories?.map((sub) => (
                                    <button
                                        key={sub}
                                        onClick={() => onSubcategoryToggle(sub)}
                                        className={`
                      px-3 py-1.5 rounded-md text-xs font-medium transition-all
                      ${selectedSubcategories.has(sub)
                                                ? 'bg-primary/20 text-primary ring-1 ring-primary/30'
                                                : 'bg-background hover:bg-muted border border-border'
                                            }
                    `}
                                    >
                                        {sub}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}