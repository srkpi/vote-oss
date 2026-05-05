'use client';

import { ExternalLink, FileText, ListChecks, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

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
import { LocalDate, LocalDateTime } from '@/components/ui/local-time';
import { Pagination } from '@/components/ui/pagination';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api/browser';
import { PROTOCOLS_PAGE_SIZE } from '@/lib/constants';
import type { ProtocolSummary } from '@/types/protocol';

interface ProtocolsPanelProps {
  groupId: string;
  initialProtocols: ProtocolSummary[];
  initialLoadError: string | null;
  canManage: boolean;
}

export function ProtocolsPanel({
  groupId,
  initialProtocols,
  initialLoadError,
  canManage,
}: ProtocolsPanelProps) {
  const { toast } = useToast();
  const [protocols, setProtocols] = useState<ProtocolSummary[]>(initialProtocols);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<ProtocolSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(protocols.length / PROTOCOLS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = protocols.slice(
    (safePage - 1) * PROTOCOLS_PAGE_SIZE,
    safePage * PROTOCOLS_PAGE_SIZE,
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await api.protocols.delete(deleteTarget.id);
    if (result.success) {
      toast({ title: 'Протокол видалено', variant: 'success' });
      setProtocols((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } else {
      toast({ title: 'Помилка', description: result.error, variant: 'error' });
    }
    setDeleting(false);
  };

  return (
    <div className="border-border-color shadow-shadow-card rounded-xl border bg-white">
      <div className="border-border-subtle flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <FileText className="text-kpi-gray-mid h-4 w-4" />
          <h2 className="font-display text-foreground text-base font-semibold">Протоколи</h2>
        </div>
        {canManage ? (
          <Button variant="accent" size="sm" asChild>
            <Link href={`/groups/${groupId}/protocols/new`}>
              <Plus className="h-3.5 w-3.5" />
              <span className="font-body text-sm">Новий</span>
            </Link>
          </Button>
        ) : (
          <span className="font-body text-muted-foreground text-sm">{protocols.length}</span>
        )}
      </div>

      {initialLoadError ? (
        <div className="p-4">
          <Alert variant="error">{initialLoadError}</Alert>
        </div>
      ) : protocols.length === 0 ? (
        <p className="font-body text-muted-foreground px-5 py-8 text-center text-sm">
          У цій групі ще немає протоколів
        </p>
      ) : (
        <ul className="divide-border-subtle divide-y">
          {paged.map((p) => {
            const year = new Date(p.date).getFullYear();
            return (
              <li key={p.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-kpi-navy/10 text-kpi-navy rounded-full px-2 py-0.5 text-xs font-semibold">
                        №{p.number}/{year}
                      </span>
                      <p className="font-body text-foreground text-sm font-semibold">{p.name}</p>
                    </div>
                    <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <span>
                        Дата: <LocalDate date={p.date} />
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ListChecks className="h-3 w-3" />
                        Пунктів: {p.agendaItemCount}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Створено <LocalDateTime date={p.createdAt} />
                      {p.updatedAt !== p.createdAt && (
                        <>
                          {' · '}оновлено <LocalDateTime date={p.updatedAt} />
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/groups/${groupId}/protocols/${p.id}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Відкрити</span>
                      </Link>
                    </Button>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(p)}
                        className="text-error hover:bg-error-bg"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="border-border-subtle border-t px-5 py-3">
          <Pagination page={safePage} totalPages={totalPages} setPage={setPage} />
        </div>
      )}

      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}>
        <DialogPanel maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Видалити протокол?</DialogTitle>
            <DialogCloseButton onClose={() => setDeleteTarget(null)} />
          </DialogHeader>
          <DialogBody>
            <Alert variant="warning">
              Протокол <strong>«{deleteTarget?.name}»</strong> буде видалено. Цю дію можна скасувати
              лише напряму через базу даних.
            </Alert>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Скасувати
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Видалити
            </Button>
          </DialogFooter>
        </DialogPanel>
      </Dialog>
    </div>
  );
}
