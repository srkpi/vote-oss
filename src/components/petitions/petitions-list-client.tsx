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

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const visible = petitions.filter((p) => !p.deletedAt);
    if (!q) return visible;
    return visible.filter(
      (p) => p.title.toLowerCase().includes(q) || p.createdBy.fullName.toLowerCase().includes(q),
    );
  }, [petitions, search]);

  if (petitions.length === 0) {
    return (
      <EmptyState
        icon={<Megaphone className="h-10 w-10" />}
        title="Петицій поки немає"
        description="Будьте першим, хто створить петицію і почне збирати підписи."
      />
    );
  }

  return (
    <div className="space-y-5">
      <SearchInput value={search} onChange={setSearch} placeholder="Пошук за назвою або автором…" />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-10 w-10" />}
          title="Нічого не знайдено"
          description="Спробуйте інший запит."
        />
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
