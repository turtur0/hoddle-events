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
            <div className="px-4 sm:px-6 py-4 border-b">
                <h3 className="flex items-center gap-2 text-xl sm:text-2xl font-semibold mb-2">
                    <Icon className="h-6 w-6 text-primary" />
                    {title}
                </h3>
                {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                )}
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6">
                {children}
            </div>
        </div>
    );
}