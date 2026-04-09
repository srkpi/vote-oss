interface VisitorCounterProps {
  name: string;
  theme?: string;
  padding?: number;
  offset?: number;
  scale?: number;
  align?: 'top' | 'center' | 'bottom';
  pixelate?: boolean;
  darkmode?: boolean | 'auto';
  className?: string;
}

export function VisitorCounter({
  name,
  theme,
  padding,
  offset,
  scale,
  align,
  pixelate,
  darkmode,
  className,
}: VisitorCounterProps) {
  const safeId = name.toLowerCase().trim().replace(/\s+/g, '-');
  const paramsMap: Record<string, unknown> = {
    name: safeId,
    theme,
    padding,
    offset,
    scale,
    align,
    darkmode: typeof darkmode === 'boolean' ? +darkmode : darkmode,
    pixelated: typeof pixelate === 'boolean' ? +pixelate : pixelate,
  };

  const query = new URLSearchParams();
  Object.entries(paramsMap).forEach(([key, value]) => {
    if (value !== undefined) {
      query.append(key, String(value));
    }
  });

  const counterUrl = `https://count.getloli.com/get/@:${safeId}?${query.toString()}`;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={counterUrl} alt="Visitor Counter" className={className} />
  );
}
