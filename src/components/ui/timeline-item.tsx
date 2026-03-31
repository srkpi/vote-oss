interface TimelineItemProps {
  label: string;
  value: string | React.ReactNode;
  icon: React.ReactNode;
  status: 'done' | 'pending';
}

export function TimelineItem({ label, value, icon, status }: TimelineItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${status === 'done' ? 'bg-kpi-navy text-white' : 'border-border-subtle bg-surface text-kpi-gray-mid border'}`}
      >
        {icon}
      </div>
      <div>
        <p className="font-body text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          {label}
        </p>
        <p className="font-body text-foreground mt-0.5 text-sm">{value}</p>
      </div>
    </div>
  );
}
