'use client';

import { Suspense } from 'react';

import { useHydration } from '@/hooks/use-hydration';
import { formatDate, formatDateTime } from '@/lib/utils';

type Props = React.ComponentProps<'time'> & {
  date: string;
};

export function LocalDate({ date, ...props }: Props) {
  const iso = new Date(date).toISOString();
  const hydrated = useHydration();
  return (
    <Suspense key={hydrated ? 'local' : 'utc'}>
      <time dateTime={iso} title={iso} {...props}>
        {formatDate(date)}
      </time>
    </Suspense>
  );
}

export function LocalDateTime({
  date,
  ...props
}: Props & {
  separator?: string;
}) {
  const iso = new Date(date).toISOString();
  const hydrated = useHydration();
  return (
    <Suspense key={hydrated ? 'local' : 'utc'}>
      <time dateTime={iso} title={iso} {...props}>
        {formatDateTime(date)}
      </time>
    </Suspense>
  );
}
