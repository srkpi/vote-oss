import React from 'react';

import { cn } from '@/lib/utils/common';

export const TextLink = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement>
>(({ className, children, href, ...props }, ref) => {
  const isExternal = typeof href === 'string' && href.startsWith('http');

  return (
    <a
      ref={ref}
      href={href}
      className={cn('text-kpi-navy underline hover:no-underline', className)}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      {...props}
    >
      {children}
    </a>
  );
});
TextLink.displayName = 'TextLink';
