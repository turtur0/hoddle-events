'use client';

import { DollarSign } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface PriceRangeSelectorProps {
    priceMin: number;
    priceMax: number;
    onMinChange: (value: number) => void;
    onMaxChange: (value: number) => void;
}

export function PriceRangeSelector({
    priceMin,
    priceMax,
    onMinChange,
    onMaxChange,
}: PriceRangeSelectorProps) {
    return (
        <div className="space-y-3">
            <Label className="flex items-center gap-2 text-base font-medium">
                <DollarSign className="h-4 w-4" />
                Price Range
            </Label>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="priceMin" className="text-xs text-muted-foreground">
                        Minimum
                    </Label>
                    <Input
                        id="priceMin"
                        type="number"
                        value={priceMin}
                        onChange={(e) => onMinChange(Number(e.target.value))}
                        min={0}
                        className="mt-1.5"
                    />
                </div>
                <div>
                    <Label htmlFor="priceMax" className="text-xs text-muted-foreground">
                        Maximum
                    </Label>
                    <Input
                        id="priceMax"
                        type="number"
                        value={priceMax}
                        onChange={(e) => onMaxChange(Number(e.target.value))}
                        min={0}
                        className="mt-1.5"
                    />
                </div>
            </div>
            <p className="text-xs text-muted-foreground">
                Free events are always included
            </p>
        </div>
    );
}