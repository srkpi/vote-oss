import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/common';

export function TextLink({ className, children, href, ...props }: ComponentProps<'a'>) {
  const isExternal = typeof href === 'string' && href.startsWith('http');

  return (
    <a
      href={href}
      className={cn('text-kpi-navy underline hover:no-underline', className)}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      {...props}
    >
      {children}
    </a>
  );
}
