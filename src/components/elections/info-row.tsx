interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-[var(--kpi-gray-mid)] shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-body font-semibold leading-tight">
          {label}
        </p>
        <p className="text-sm text-[var(--foreground)] font-body mt-0.5 leading-snug">{value}</p>
      </div>
    </div>
  );
}
