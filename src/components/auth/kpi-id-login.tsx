import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { KPI_APP_ID, KPI_AUTH_URL } from '@/lib/config/client';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';
type LogoAlignment = 'left' | 'right';

interface KpiIdLoginProps {
  appId?: string;
  size?: Size;
  logoAlignment?: LogoAlignment;
  caption?: string;
  fullWidth?: boolean;
  className?: string;
  authUrl?: string;
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

export function KpiIdLogin({
  appId = KPI_APP_ID,
  size = 'lg',
  logoAlignment = 'left',
  caption = 'Увійти з KPI ID',
  fullWidth = false,
  className = '',
  authUrl = KPI_AUTH_URL,
}: KpiIdLoginProps) {
  const logoSize = LOGO_SIZES[size];
  const href = `${authUrl}?appId=${appId}`;

  return (
    <Button
      asChild
      fullWidth={fullWidth}
      className={cn(
        SIZE_PADDING[size],
        'bg-kpi-blue-mid active:bg-kpi-blue-mid hover:bg-[#0061a0]',
        logoAlignment === 'right' ? 'flex-row-reverse' : 'flex-row',
        className,
      )}
    >
      <Link href={href}>
        <Image src="/kpi-logo.svg" alt="KPI Logo" width={logoSize} height={logoSize} preload />
        <span>{caption}</span>
      </Link>
    </Button>
  );
}
