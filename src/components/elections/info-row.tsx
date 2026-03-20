interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-(--kpi-gray-mid)">{icon}</span>
      <div className="min-w-0">
        <p className="font-body text-[10px] leading-tight font-semibold tracking-wider text-(--muted-foreground) uppercase">
          {label}
        </p>
        <p className="font-body mt-0.5 text-sm leading-snug text-(--foreground)">{value}</p>
      </div>
    </div>
  );
}
