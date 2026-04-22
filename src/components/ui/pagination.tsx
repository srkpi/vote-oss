import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/common';

interface PaginationProps {
  page: number;
  totalPages: number;
  maxVisibleButtons?: number;
  showPagesCount?: boolean;
  setPage: (page: number | ((p: number) => number)) => void;
}

export function Pagination({
  page,
  totalPages,
  maxVisibleButtons = 5,
  showPagesCount,
  setPage,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const visiblePages = Math.min(maxVisibleButtons, totalPages);
  const startPage = Math.max(
    1,
    Math.min(page - Math.floor(visiblePages / 2), totalPages - visiblePages + 1),
  );
  const pages = Array.from({ length: visiblePages }, (_, i) => startPage + i);

  return (
    <div className="flex flex-col items-center justify-between gap-4 py-2 sm:flex-row">
      {showPagesCount && (
        <p className="font-body text-muted-foreground text-center sm:text-left">
          Сторінка {page} з {totalPages}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Назад</span>
        </Button>

        <div className="flex items-center gap-1">
          {pages.map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={cn(
                'font-body h-8 w-8 rounded-(--radius) text-sm font-medium transition-all duration-150',
                p === page
                  ? 'bg-kpi-navy shadow-shadow-sm text-white'
                  : 'text-muted-foreground hover:bg-surface hover:text-foreground',
              )}
            >
              {p}
            </button>
          ))}
        </div>

        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          iconPosition="right"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="hidden sm:inline">Вперед</span>
        </Button>
      </div>
    </div>
  );
}
