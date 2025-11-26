'use client';

import { POPULARITY_OPTIONS } from '@/lib/constants/preferences';
import { Label } from '@/components/ui/Label';
import { Check } from 'lucide-react';

interface PopularitySelectorProps {
    value: number;
    onChange: (value: number) => void;
    variant?: 'cards' | 'buttons';
}

export function PopularitySelector({
    value,
    onChange,
    variant = 'cards'
}: PopularitySelectorProps) {
    if (variant === 'buttons') {
        return (
            <div className="grid grid-cols-3 gap-2">
                {POPULARITY_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = value === option.value;

                    return (
                        <button
                            key={option.value}
                            onClick={() => onChange(option.value)}
                            className={`
                                flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                                ${isSelected
                                    ? 'bg-primary/10 border-primary text-primary'
                                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                }
                            `}
                        >
                            <Icon className="h-5 w-5" />
                            <span className="text-sm font-medium">{option.label}</span>
                        </button>
                    );
                })}
            </div>
        );
    }

    // Card variant (default)
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {POPULARITY_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = value === option.value;

                return (
                    <button
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        className={`
                            p-4 rounded-lg border-2 transition-all text-left
                            ${isSelected
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                            }
                        `}
                    >
                        <div className="flex items-start gap-3">
                            <Icon className={`h-5 w-5 mt-0.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'
                                }`} />
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{option.label}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                    {option.description}
                                </div>
                            </div>
                            {isSelected && (
                                <Check className="h-5 w-5 text-primary shrink-0" />
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}