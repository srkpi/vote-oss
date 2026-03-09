interface StatItemProps {
  value: string;
  label: string;
}

export function StatItem({ value, label }: StatItemProps) {
  return (
    <div className="text-center">
      <div className="font-display text-4xl font-bold text-white mb-2">{value}</div>
      <div className="text-sm text-white/60 font-body uppercase tracking-wider">{label}</div>
    </div>
  );
}
