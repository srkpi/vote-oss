interface StatItemProps {
  value: string;
  label: string;
}

export function StatItem({ value, label }: StatItemProps) {
  return (
    <div className="text-center">
      <div className="font-display mb-2 text-4xl font-bold text-white">{value}</div>
      <div className="font-body text-sm tracking-wider text-white/60 uppercase">{label}</div>
    </div>
  );
}
