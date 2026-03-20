interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-kpi-gray-mid mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="font-body text-muted-foreground text-[10px] leading-tight font-semibold tracking-wider uppercase">
          {label}
        </p>
        <p className="font-body text-foreground mt-0.5 text-sm leading-snug">{value}</p>
      </div>
    </div>
  );
}
