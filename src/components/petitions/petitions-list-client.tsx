'use client';

import { Megaphone } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { PetitionCard } from '@/components/petitions/petition-card';
import { SearchInput } from '@/components/ui/search-input';
import type { Election } from '@/types/election';

interface PetitionsListClientProps {
  petitions: Election[];
}

export function PetitionsListClient({ petitions }: PetitionsListClientProps) {
  const [search, setSearch] = useState('');

  const visible = useMemo(() => petitions.filter((p) => !p.deletedAt), [petitions]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return visible;
    return visible.filter(
      (p) => p.title.toLowerCase().includes(q) || p.createdBy.fullName.toLowerCase().includes(q),
    );
  }, [visible, search]);

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
      <SearchInput value={search} onChange={setSearch} placeholder="Пошук за назвою або автором…" />

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
