interface TimelineItemProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  status: 'done' | 'pending';
}

export function TimelineItem({ label, value, icon, status }: TimelineItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${status === 'done' ? 'bg-[var(--kpi-navy)] text-white' : 'bg-[var(--surface)] text-[var(--kpi-gray-mid)] border border-[var(--border-subtle)]'}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-body font-semibold">
          {label}
        </p>
        <p className="text-sm font-body text-[var(--foreground)] mt-0.5">{value}</p>
      </div>
    </div>
  );
}
