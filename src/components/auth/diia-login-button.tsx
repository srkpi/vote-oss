import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';
type LogoAlignment = 'left' | 'right';

interface KpiIdLoginProps {
  onClick?: () => void;
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

export function DiiaLoginButton({
  onClick,
  size = 'lg',
  logoAlignment = 'left',
  caption = 'Вхід через Дію',
  fullWidth = false,
  className = '',
}: KpiIdLoginProps) {
  const logoSize = LOGO_SIZES[size];

  return (
    <Button
      onClick={onClick}
      fullWidth={fullWidth}
      className={cn(
        SIZE_PADDING[size],
        'bg-black text-white hover:bg-neutral-800 active:bg-neutral-900',
        logoAlignment === 'right' ? 'flex-row-reverse' : 'flex-row',
        className,
      )}
    >
      <Image src="/diia-logo.svg" alt="Diia logo" width={logoSize} height={logoSize} preload />
      <span>{caption}</span>
    </Button>
  );
}
