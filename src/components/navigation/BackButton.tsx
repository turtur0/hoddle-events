'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface BackButtonProps {
    fallbackUrl?: string;
    className?: string;
}

export function BackButton({ fallbackUrl = '/', className }: BackButtonProps) {
    const router = useRouter();

    const handleBack = () => {
        // Check if there's browser history
        if (window.history.length > 1) {
            router.back();
        } else {
            // No history, go to fallback
            router.push(fallbackUrl);
        }
    };

    return (
        <Button variant="ghost" onClick={handleBack} className={className}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
        </Button>
    );
}