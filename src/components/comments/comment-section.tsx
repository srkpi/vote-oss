'use client';

import { useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import { COMMENTS_INITIAL_PAGE_SIZE, COMMENTS_LOAD_MORE_PAGE_SIZE } from '@/lib/constants';
import { cn } from '@/lib/utils/common';
import type {
  Comment,
  CommentsListResponse,
  CommentSort,
  CommentSortDirection,
} from '@/types/comment';

import { CommentComposer } from './comment-composer';
import { CommentItem } from './comment-item';
import { CommentSortControl } from './comment-sort-control';

interface CommentSectionProps {
  electionId: string;
  discussionClosed: boolean;
  initialData: CommentsListResponse | null;
  fetchError: string | null;
  onCommentCreated?: () => void;
}

// Safety cap on how many pages handleCreate will chain-fetch while backfilling
// a gap (see there) — comfortably above any realistic discussion thread, just
// enough to guarantee the loop can't run away if the backend ever misbehaves.
const MAX_BACKFILL_PAGES = 10;

/** Mirrors the API's own tie-break chain (rating/date, then date, then id). */
function compareComments(
  a: Comment,
  b: Comment,
  sort: CommentSort,
  direction: CommentSortDirection,
): number {
  let result: number;
  if (sort === 'rating') {
    result = a.upCount - a.downCount - (b.upCount - b.downCount);
    if (result === 0) result = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  } else {
    result = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  }
  if (result === 0) result = a.id.localeCompare(b.id);
  return direction === 'asc' ? result : -result;
}

export function CommentSection({
  electionId,
  discussionClosed,
  initialData,
  fetchError,
  onCommentCreated,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialData?.comments ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initialData?.nextCursor ?? null);
  const [hasMore, setHasMore] = useState(initialData?.hasMore ?? false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState<CommentSort>('date');
  const [direction, setDirection] = useState<CommentSortDirection>('asc');
  const [sortLoading, setSortLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Comment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  // "Load more" and changing the sort each read/replace the comments list
  // wholesale, and so does the backfill below — keeping all three mutually
  // exclusive (via loadingMore / sortLoading / creating, checked together
  // below) means one can't clobber a list another just fetched.
  const busy = loadingMore || sortLoading || creating;

  const handleCreate = async (body: string) => {
    setCreating(true);
    try {
      const { data: created, error } = await api.elections.comments.create(electionId, body);
      if (error || !created) throw new Error(error ?? 'Не вдалося опублікувати коментар');

      onCommentCreated?.();

      // A brand new comment is always the newest in the thread. If the
      // rest of the thread hasn't been fully loaded yet, simply appending
      // it here would leave a gap — some already-posted comments the
      // reader hasn't seen, followed by this one out of place. Catch up
      // first so the list stays contiguous, then insert the new comment
      // wherever the active sort puts it (last for oldest-first, first
      // for newest-first, its sorted slot for rating).
      try {
        let merged = comments;
        let cursor = nextCursor;
        let more = hasMore;
        let pages = 0;

        while (more) {
          if (++pages > MAX_BACKFILL_PAGES) throw new Error('Забагато сторінок для довантаження');
          const { data, error: pageError } = await api.elections.comments.list(electionId, {
            cursor: cursor ?? undefined,
            limit: COMMENTS_LOAD_MORE_PAGE_SIZE,
            sort,
            direction,
          });
          if (pageError || !data) throw new Error(pageError ?? 'Не вдалося довантажити коментарі');
          merged = [...merged, ...data.comments];
          cursor = data.nextCursor;
          more = data.hasMore;
        }

        if (!merged.some((c) => c.id === created.id)) {
          merged = [...merged, created];
        }

        setComments(merged.sort((a, b) => compareComments(a, b, sort, direction)));
        setNextCursor(null);
        setHasMore(false);
      } catch {
        // The comment itself was posted successfully — the backfill failed.
      }
    } finally {
      setCreating(false);
    }
  };

  const handleUpdated = (updated: Comment) => {
    setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const { data, error } = await api.elections.comments.list(electionId, {
        cursor: nextCursor ?? undefined,
        limit: COMMENTS_LOAD_MORE_PAGE_SIZE,
        sort,
        direction,
      });
      if (error || !data) throw new Error(error ?? 'Не вдалося завантажити коментарі');
      // Continuing the list in whatever order is currently active, so the
      // new page always belongs after what's already on screen.
      setComments((prev) => [...prev, ...data.comments]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      toast({
        title: 'Не вдалося завантажити ще',
        description: err instanceof Error ? err.message : 'Спробуйте ще раз',
        variant: 'error',
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSortChange = async (nextSort: CommentSort, nextDirection: CommentSortDirection) => {
    if (nextSort === sort && nextDirection === direction) return;
    setSort(nextSort);
    setDirection(nextDirection);
    setSortLoading(true);
    try {
      const { data, error } = await api.elections.comments.list(electionId, {
        limit: COMMENTS_INITIAL_PAGE_SIZE,
        sort: nextSort,
        direction: nextDirection,
      });
      if (error || !data) throw new Error(error ?? 'Не вдалося змінити сортування');
      setComments(data.comments);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      toast({
        title: 'Не вдалося змінити сортування',
        description: err instanceof Error ? err.message : 'Спробуйте ще раз',
        variant: 'error',
      });
    } finally {
      setSortLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const { data, error } = await api.elections.comments.remove(electionId, pendingDelete.id);
      if (error || !data) throw new Error(error ?? 'Не вдалося видалити коментар');
      handleUpdated(data);
      setPendingDelete(null);
    } catch (err) {
      toast({
        title: 'Не вдалося видалити',
        description: err instanceof Error ? err.message : 'Спробуйте ще раз',
        variant: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (fetchError && comments.length === 0) {
    return (
      <Alert variant="error" title="Не вдалося завантажити коментарі">
        {fetchError}
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {discussionClosed ? (
        <Alert variant="info" title="Обговорення закрито">
          Адміністрація закрила можливість залишати нові коментарі та редагувати наявні. Видалення
          власних коментарів і оцінки досі доступні.
        </Alert>
      ) : (
        <CommentComposer onSubmit={handleCreate} disabled={loadingMore || sortLoading} />
      )}

      {comments.length === 0 ? (
        !discussionClosed && (
          <EmptyState
            title="Ще немає коментарів"
            description="Будьте першим, хто залишить коментар."
          />
        )
      ) : (
        <>
          <div className="flex justify-end">
            <CommentSortControl
              sort={sort}
              direction={direction}
              onChange={handleSortChange}
              disabled={busy}
            />
          </div>

          <div
            className={cn(
              'space-y-3 transition-opacity',
              sortLoading && 'pointer-events-none opacity-50',
            )}
          >
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                electionId={electionId}
                comment={comment}
                discussionClosed={discussionClosed}
                onUpdated={handleUpdated}
                onRequestDelete={setPendingDelete}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                onClick={handleLoadMore}
                loading={loadingMore}
                disabled={busy}
                size="sm"
              >
                Завантажити наступні коментарі
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={!!pendingDelete} onClose={() => setPendingDelete(null)}>
        <DialogPanel>
          <DialogHeader>
            <DialogTitle>Видалити коментар?</DialogTitle>
            <DialogCloseButton onClose={() => setPendingDelete(null)} />
          </DialogHeader>
          <DialogBody>
            <p className="font-body text-muted-foreground text-sm">
              Текст коментаря буде прибрано, але запис про його видалення залишиться видимим.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Скасувати
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} loading={deleting}>
              Видалити
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
    </div>
  );
}
