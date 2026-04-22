import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  maxVisibleButtons?: number;
  setPage: (page: number | ((p: number) => number)) => void;
}

// Each page button is size-9 (36px) with gap-1 (4px) between = 40px per slot
const SLOT_PX = 40;

const slideVariants = {
  enter: (dir: number) => ({ x: dir * SLOT_PX * 0.6, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -SLOT_PX * 0.6, opacity: 0 }),
};

const slideTransition = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const };

export function Pagination({ page, totalPages, maxVisibleButtons = 5, setPage }: PaginationProps) {
  const [dir, setDir] = useState(0);

  if (totalPages <= 1) return null;

  // Wrap setPage so we can record direction before navigating
  const navigate = (target: number | ((p: number) => number)) => {
    const next = typeof target === 'function' ? target(page) : target;
    setDir(next > page ? 1 : -1);
    setPage(target);
  };

  const visiblePages = Math.min(maxVisibleButtons, totalPages);
  const allPagesVisible = totalPages <= visiblePages;
  const startPage = Math.max(
    1,
    Math.min(page - Math.floor(visiblePages / 2), totalPages - visiblePages + 1),
  );
  const pages = Array.from({ length: visiblePages }, (_, i) => startPage + i);

  // Fixed container width prevents layout shift while rows are cross-fading
  const containerWidth = visiblePages * 36 + (visiblePages - 1) * 4;

  return (
    <div className="flex items-center justify-center gap-0">
      {!allPagesVisible && (
        <motion.div
          whileTap={{ scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={page <= 1}
            onClick={() => navigate(1)}
            aria-label="First page"
            icon={<ChevronsLeft />}
          />
        </motion.div>
      )}

      <motion.div
        whileTap={{ scale: 0.85 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={page <= 1}
          onClick={() => navigate((p) => p - 1)}
          aria-label="Previous page"
          icon={<ChevronLeft />}
        />
      </motion.div>

      {/*
        Outer div: fixed width + overflow-hidden clips the sliding rows.
        AnimatePresence keys on startPage — when the visible window shifts,
        the old row slides out and the new one slides in from the correct side.
        When only the active page changes within the same window, startPage is
        stable so no row-level animation fires; the pill handles it via layoutId.
      */}
      <div className="relative overflow-hidden" style={{ width: containerWidth }}>
        <AnimatePresence custom={dir} mode="popLayout" initial={false}>
          <motion.div
            key={startPage}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            className="relative flex items-center gap-1"
          >
            {/* Sliding active pill — lives inside the row so it travels with it */}
            {pages.map((p, i) =>
              p === page ? (
                <motion.div
                  key="pill"
                  layoutId="pagination-active-pill"
                  className="bg-primary absolute size-9 rounded-md"
                  style={{ left: i * SLOT_PX }}
                  transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                />
              ) : null,
            )}

            {pages.map((p) => (
              <Button
                key={p}
                size="icon"
                variant={p === page ? 'default' : 'ghost'}
                onClick={() => navigate(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? 'page' : undefined}
                className={`relative z-10 transition-colors duration-150 ${p === page ? 'pointer-events-none bg-transparent font-semibold' : ''}`}
              >
                {p}
              </Button>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <motion.div
        whileTap={{ scale: 0.85 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={page >= totalPages}
          onClick={() => navigate((p) => p + 1)}
          aria-label="Next page"
          icon={<ChevronRight />}
        />
      </motion.div>

      {!allPagesVisible && (
        <motion.div
          whileTap={{ scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={page >= totalPages}
            onClick={() => navigate(totalPages)}
            aria-label="Last page"
            icon={<ChevronsRight />}
          />
        </motion.div>
      )}
    </div>
  );
}
