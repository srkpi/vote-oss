import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/common';

type Size = 'sm' | 'md' | 'lg';
type LogoAlignment = 'left' | 'right';

interface KpiIdButtonProps {
  size?: Size;
  logoAlignment?: LogoAlignment;
  caption?: string;
  fullWidth?: boolean;
  className?: string;
}

const SIZE_PADDING: Record<Size, string> = {
  sm: 'h-auto px-[10px] py-[7px] gap-[5px] text-xs leading-4',
  md: 'h-auto px-[12px] py-[9px] gap-[6px] text-sm leading-5',
  lg: 'h-auto px-[16px] py-[11px] gap-[8px] text-base leading-6',
};

const LOGO_SIZES: Record<Size, number> = {
  sm: 20,
  md: 24,
  lg: 32,
};

export function KpiIdButton({
  size = 'lg',
  logoAlignment = 'left',
  caption = 'Увійти з KPI ID',
  fullWidth = false,
  className = '',
}: KpiIdButtonProps) {
  const logoSize = LOGO_SIZES[size];

  return (
    <Button
      asChild
      fullWidth={fullWidth}
      className={cn(
        SIZE_PADDING[size],
        'bg-[#1062a3] hover:bg-[#0061a0] active:bg-[#1062a3]',
        logoAlignment === 'right' ? 'flex-row-reverse' : 'flex-row',
        className,
      )}
    >
      {/* Full navigation is required for the OIDC redirect and transaction cookie. */}
      {/* eslint-disable-next-line next/no-html-link-for-pages */}
      <a href="/api/auth/kpi-id/login">
        <Image src="/kpi-logo.svg" alt="KPI Logo" width={logoSize} height={logoSize} preload />
        <span>{caption}</span>
      </a>
    </Button>
  );
}
