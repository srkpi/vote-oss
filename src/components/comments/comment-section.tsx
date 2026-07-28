'use client';

import { useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import { COMMENTS_LOAD_MORE_PAGE_SIZE } from '@/lib/constants';
import type { Comment, CommentsListResponse } from '@/types/comment';

import { CommentComposer } from './comment-composer';
import { CommentItem } from './comment-item';

interface CommentSectionProps {
  electionId: string;
  discussionClosed: boolean;
  initialData: CommentsListResponse | null;
  fetchError: string | null;
}

export function CommentSection({
  electionId,
  discussionClosed,
  initialData,
  fetchError,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialData?.comments ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initialData?.nextCursor ?? null);
  const [hasMore, setHasMore] = useState(initialData?.hasMore ?? false);
  const [loadingMore, setLoadingMore] = useState(false);
  const { toast } = useToast();

  const handleCreate = async (body: string) => {
    const { data, error } = await api.elections.comments.create(electionId, body);
    if (error || !data) throw new Error(error ?? 'Не вдалося опублікувати коментар');
    // New comment is the newest — with oldest-first ordering it belongs at the end.
    setComments((prev) => [...prev, data]);
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
      });
      if (error || !data) throw new Error(error ?? 'Не вдалося завантажити коментарі');
      // Continuing forward in time — new page's comments are newer, so append.
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
        <CommentComposer onSubmit={handleCreate} />
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={handleLoadMore} loading={loadingMore} size="sm">
            Завантажити попередні коментарі
          </Button>
        </div>
      )}

      {comments.length === 0 ? (
        !discussionClosed && (
          <EmptyState
            title="Ще немає коментарів"
            description="Будьте першим, хто залишить коментар."
          />
        )
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              electionId={electionId}
              comment={comment}
              discussionClosed={discussionClosed}
              onUpdated={handleUpdated}
              onDeleted={handleUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}
