import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';
type LogoAlignment = 'left' | 'right';

interface KpiIdLoginProps {
  appId: string;
  size?: Size;
  logoAlignment?: LogoAlignment;
  caption?: string;
  fullWidth?: boolean;
  className?: string;
  devMode?: boolean;
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
  appId,
  size = 'lg',
  logoAlignment = 'left',
  caption = 'Увійти з KPI ID',
  fullWidth = false,
  className = '',
  devMode = process.env.NEXT_PUBLIC_ENV !== 'production',
}: KpiIdLoginProps) {
  const logoSize = LOGO_SIZES[size];
  const href = devMode
    ? `https://auth.cloud.kpi.ua?appId=${appId}`
    : `https://auth.kpi.ua?appId=${appId}`;

  return (
    <Button
      asChild
      fullWidth={fullWidth}
      className={cn(
        SIZE_PADDING[size],
        'bg-[var(--color-kpi-blue-mid)] hover:bg-[#0061a0] active:bg-[var(--color-kpi-blue-mid)]',
        logoAlignment === 'right' ? 'flex-row-reverse' : 'flex-row',
        className,
      )}
    >
      <Link href={href}>
        <Image src="/kpi-logo.svg" alt="KPI Logo" width={logoSize} height={logoSize} />
        <span>{caption}</span>
      </Link>
    </Button>
  );
}
