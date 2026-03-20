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
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${status === 'done' ? 'bg-(--kpi-navy) text-white' : 'border border-(--border-subtle) bg-(--surface) text-(--kpi-gray-mid)'}`}
      >
        {icon}
      </div>
      <div>
        <p className="font-body text-[10px] font-semibold tracking-wider text-(--muted-foreground) uppercase">
          {label}
        </p>
        <p className="font-body mt-0.5 text-sm text-(--foreground)">{value}</p>
      </div>
    </div>
  );
}
