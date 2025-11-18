'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
    const searchParams = useSearchParams();

    // Create URL with page parameter
    const createPageURL = (page: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', page.toString());
        return `?${params.toString()}`;
    };

    // Don't show pagination if only 1 page
    if (totalPages <= 1) return null;

    const hasPrevious = currentPage > 1;
    const hasNext = currentPage < totalPages;

    return (
        <div className="flex items-center justify-center gap-2">
            {/* Previous Button */}
            <Link
                href={createPageURL(currentPage - 1)}
                className={`
          flex items-center gap-1 px-4 py-2 rounded-md border
          ${hasPrevious
                        ? 'hover:bg-accent cursor-pointer'
                        : 'opacity-50 pointer-events-none'
                    }
        `}
                aria-disabled={!hasPrevious}
            >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
            </Link>

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

                    return (
                        <Link
                            key={page}
                            href={createPageURL(page)}
                            className={`
                px-4 py-2 rounded-md border min-w-[40px] text-center
                ${page === currentPage
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-accent'
                                }
              `}
                        >
                            {page}
                        </Link>
                    );
                })}
            </div>

            {/* Next Button */}
            <Link
                href={createPageURL(currentPage + 1)}
                className={`
          flex items-center gap-1 px-4 py-2 rounded-md border
          ${hasNext
                        ? 'hover:bg-accent cursor-pointer'
                        : 'opacity-50 pointer-events-none'
                    }
        `}
                aria-disabled={!hasNext}
            >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
            </Link>
        </div>
    );
}