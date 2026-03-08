'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { cn, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ElectionStatusBadge } from '@/components/elections/election-status-badge';
import { EmptyState, ErrorState } from '@/components/common/empty-state';
import type { Election, ElectionStatus } from '@/types';

interface AdminElectionsClientProps {
  elections: Election[];
  error: string | null;
}

type TabKey = 'all' | ElectionStatus;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Усі' },
  { key: 'open', label: 'Активні' },
  { key: 'upcoming', label: 'Майбутні' },
  { key: 'closed', label: 'Завершені' },
];

export function AdminElectionsClient({ elections, error }: AdminElectionsClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');

  const counts: Record<TabKey, number> = useMemo(
    () => ({
      all: elections.length,
      open: elections.filter((e) => e.status === 'open').length,
      upcoming: elections.filter((e) => e.status === 'upcoming').length,
      closed: elections.filter((e) => e.status === 'closed').length,
    }),
    [elections],
  );

  const filtered = useMemo(() => {
    let result = elections;
    if (activeTab !== 'all') {
      result = result.filter((e) => e.status === activeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.creator.full_name.toLowerCase().includes(q) ||
          (e.restrictedToFaculty?.toLowerCase().includes(q) ?? false) ||
          (e.restrictedToGroup?.toLowerCase().includes(q) ?? false),
      );
    }
    return result;
  }, [elections, activeTab, search]);

  if (error) {
    return (
      <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)]">
        <ErrorState title="Помилка завантаження" description={error} />
      </div>
    );
  }

  return (
    <div
      className="space-y-4 animate-fade-up"
      style={{ animationDelay: '200ms', animationFillMode: 'both' }}
    >
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-1 p-1 bg-white border border-[var(--border-subtle)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xs)] overflow-x-auto shrink-0">
          {TABS.map((tab) => {
            const count = counts[tab.key];
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-sm font-medium font-body whitespace-nowrap transition-all duration-150',
                  isActive
                    ? 'bg-[var(--kpi-navy)] text-white shadow-[var(--shadow-sm)]'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]',
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold px-1',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--surface)] text-[var(--muted-foreground)]',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 max-w-sm">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--kpi-gray-mid)] pointer-events-none">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук голосувань…"
            className={cn(
              'w-full h-9 pl-9 pr-9 text-sm font-body',
              'bg-white border border-[var(--border-color)] rounded-[var(--radius-lg)]',
              'placeholder:text-[var(--subtle)]',
              'focus:outline-none focus:border-[var(--kpi-blue-light)] focus:ring-2 focus:ring-[var(--kpi-blue-light)]/20',
              'transition-colors duration-150 shadow-[var(--shadow-xs)]',
            )}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {(search || activeTab !== 'all') && filtered.length > 0 && (
          <p className="text-xs text-[var(--muted-foreground)] font-body shrink-0">
            {filtered.length} з {elections.length}
          </p>
        )}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)]">
          <EmptyState
            icon={
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
            title={search ? 'Голосувань не знайдено' : 'Голосувань поки немає'}
            description={
              search
                ? `За запитом «${search}» нічого не знайдено`
                : 'Створіть перше голосування для вашого факультету'
            }
            action={
              !search ? { label: 'Створити голосування', href: '/admin/elections/new' } : undefined
            }
          />
        </div>
      ) : (
        <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden">
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  {['Назва', 'Статус', 'Строки', 'Бюлетені', 'Доступ', 'Дії'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider font-body"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filtered.map((election) => (
                  <ElectionRow key={election.id} election={election} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet cards */}
          <div className="lg:hidden divide-y divide-[var(--border-subtle)]">
            {filtered.map((election) => (
              <ElectionMobileCard key={election.id} election={election} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ElectionRow({ election }: { election: Election }) {
  return (
    <tr className="hover:bg-[var(--surface)] transition-colors duration-150 group">
      <td className="px-4 py-3.5 max-w-xs">
        <div>
          <p className="text-sm font-medium font-body text-[var(--foreground)] truncate group-hover:text-[var(--kpi-navy)] transition-colors">
            {election.title}
          </p>
          <p className="text-xs font-body text-[var(--muted-foreground)] mt-0.5 truncate">
            {election.creator.full_name}
          </p>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <ElectionStatusBadge status={election.status} size="sm" />
      </td>
      <td className="px-4 py-3.5">
        <div>
          <p className="text-xs font-body text-[var(--foreground)]">
            {formatDateTime(election.opensAt)}
          </p>
          <p className="text-xs font-body text-[var(--muted-foreground)] mt-0.5">
            → {formatDateTime(election.closesAt)}
          </p>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-xl font-bold text-[var(--foreground)]">
            {election.ballotCount.toLocaleString('uk-UA')}
          </span>
          {election.status === 'open' && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse shrink-0" />
          )}
        </div>
      </td>
      <td className="px-4 py-3.5">
        {election.restrictedToFaculty || election.restrictedToGroup ? (
          <div className="flex flex-col gap-1">
            {election.restrictedToFaculty && (
              <Badge variant="info" size="sm">
                {election.restrictedToFaculty}
              </Badge>
            )}
            {election.restrictedToGroup && (
              <Badge variant="secondary" size="sm">
                {election.restrictedToGroup}
              </Badge>
            )}
          </div>
        ) : (
          <Badge variant="success" size="sm">
            Всі
          </Badge>
        )}
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="xs" asChild>
            <Link href={`/admin/elections/${election.id}`}>Деталі</Link>
          </Button>
          <Button variant="ghost" size="xs" asChild>
            <Link href={`/elections/${election.id}/ballots`}>Бюлетені</Link>
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ElectionMobileCard({ election }: { election: Election }) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold font-body text-[var(--foreground)] leading-snug">
            {election.title}
          </p>
          <p className="text-xs font-body text-[var(--muted-foreground)] mt-0.5">
            {election.creator.full_name}
          </p>
        </div>
        <ElectionStatusBadge status={election.status} size="sm" />
      </div>

      <div className="flex items-center gap-4 text-xs font-body text-[var(--muted-foreground)]">
        <div className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {formatDateTime(election.closesAt)}
        </div>
        <div className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="font-semibold text-[var(--foreground)]">{election.ballotCount}</span>{' '}
          бюлетенів
        </div>
        {(election.restrictedToFaculty || election.restrictedToGroup) && (
          <Badge variant="info" size="sm">
            {election.restrictedToGroup ?? election.restrictedToFaculty}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button variant="secondary" size="sm" fullWidth asChild>
          <Link href={`/admin/elections/${election.id}`}>Деталі</Link>
        </Button>
        <Button variant="ghost" size="sm" fullWidth asChild>
          <Link href={`/elections/${election.id}/ballots`}>Бюлетені</Link>
        </Button>
      </div>
    </div>
  );
}
