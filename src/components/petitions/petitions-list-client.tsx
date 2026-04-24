'use client';

import { Clock, Megaphone, TrendingUp } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { PetitionCard } from '@/components/petitions/petition-card';
import { SearchInput } from '@/components/ui/search-input';
import type { Tab } from '@/components/ui/tabs';
import { Tabs } from '@/components/ui/tabs';
import type { Election } from '@/types/election';

type SortKey = 'createdAt' | 'votes';

const SORT_TABS: Tab<SortKey>[] = [
  { key: 'createdAt', label: 'Спочатку нові', icon: <Clock className="h-3.5 w-3.5" /> },
  { key: 'votes', label: 'Найбільше голосів', icon: <TrendingUp className="h-3.5 w-3.5" /> },
];

interface PetitionsListClientProps {
  petitions: Election[];
  sort: SortKey;
}

export function PetitionsListClient({ petitions, sort }: PetitionsListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');

  const visible = useMemo(() => petitions.filter((p) => !p.deletedAt), [petitions]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return visible;
    return visible.filter(
      (p) => p.title.toLowerCase().includes(q) || p.createdBy.fullName.toLowerCase().includes(q),
    );
  }, [visible, search]);

  const handleSortChange = (next: SortKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'createdAt') params.delete('sort');
    else params.set('sort', next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  if (visible.length === 0) {
    return (
      <div className="border-border-color shadow-shadow-sm overflow-hidden rounded-xl border bg-white">
        <EmptyState
          icon={<Megaphone className="h-10 w-10" />}
          title="Немає жодної петиції"
          description="Будьте першим, хто створить петицію і почне збирати підписи."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Пошук за назвою або автором…"
          className="flex-1"
        />
        <Tabs
          tabs={SORT_TABS}
          activeTab={sort}
          onTabChange={handleSortChange}
          className="sm:w-auto sm:shrink-0"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="border-border-color shadow-shadow-sm overflow-hidden rounded-xl border bg-white">
          <EmptyState
            icon={<Megaphone className="h-10 w-10" />}
            title="Нічого не знайдено"
            description="Спробуйте інший запит."
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <PetitionCard key={p.id} petition={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
