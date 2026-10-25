'use client';

import { Suspense } from 'react';
import { useIsClient } from 'usehooks-ts';

import { formatDate, formatDateTime } from '@/lib/utils/common';

type Props = React.ComponentProps<'time'> & {
  date: string;
};

export function LocalDate({ date, ...props }: Props) {
  const iso = new Date(date).toISOString();
  const hydrated = useIsClient();
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
  const hydrated = useIsClient();
  return (
    <Suspense key={hydrated ? 'local' : 'utc'}>
      <time dateTime={iso} title={iso} {...props}>
        {formatDateTime(date)}
      </time>
    </Suspense>
  );
}
