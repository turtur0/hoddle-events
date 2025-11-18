'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Create URL with page parameter
    const createPageURL = (page: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', page.toString());
        return `${pathname}?${params.toString()}`;
    };

    // Navigate to page
    const goToPage = (page: number) => {
        const url = createPageURL(page);
        router.push(url, { scroll: false }); // Prevent scroll to top
    };

    // Don't show pagination if only 1 page
    if (totalPages <= 1) return null;

    const hasPrevious = currentPage > 1;
    const hasNext = currentPage < totalPages;

    return (
        <div className="flex items-center justify-center gap-2">
            {/* Previous Button */}
            <Button
                variant="outline"
                onClick={() => goToPage(currentPage - 1)}
                disabled={!hasPrevious}
                className="flex items-center gap-1"
            >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
            </Button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show first, last, current, and adjacent pages
                    const showPage =
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1);

                    // Show ellipsis
                    const showEllipsis =
                        (page === currentPage - 2 && currentPage > 3) ||
                        (page === currentPage + 2 && currentPage < totalPages - 2);

                    if (showEllipsis) {
                        return (
                            <span key={page} className="px-2 text-muted-foreground">
                                ...
                            </span>
                        );
                    }

                    if (!showPage) return null;

                    const isCurrentPage = page === currentPage;

                    return (
                        <Button
                            key={page}
                            variant={isCurrentPage ? "default" : "outline"}
                            onClick={() => goToPage(page)}
                            className="min-w-10"
                            disabled={isCurrentPage}
                        >
                            {page}
                        </Button>
                    );
                })}
            </div>

            {/* Next Button */}
            <Button
                variant="outline"
                onClick={() => goToPage(currentPage + 1)}
                disabled={!hasNext}
                className="flex items-center gap-1"
            >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
}