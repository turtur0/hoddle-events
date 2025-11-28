// components/analytics/ChartWrapper.tsx
'use client';

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface ChartWrapperProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    children: ReactNode;
}

export function ChartWrapper({ icon: Icon, title, description, children }: ChartWrapperProps) {
    return (
        <div className="bg-card rounded-xl border-2 shadow-sm overflow-hidden transition-all hover:shadow-md">
            {/* Header */}
            <div className="px-4 sm:px-6 py-4 border-b bg-muted/30">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                        <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-base sm:text-lg">{title}</h3>
                        {description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6">
                {children}
            </div>
        </div>
    );
}