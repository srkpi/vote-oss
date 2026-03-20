interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: 'navy' | 'orange' | 'success' | 'info';
}

const accentStyles = {
  navy: 'navy-gradient',
  orange: 'bg-(--kpi-orange)',
  success: 'bg-(--success)',
  info: 'bg-(--kpi-blue-light)',
};

export function StatCard({ label, value, accent, icon }: StatCardProps) {
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-(--border-color) bg-white p-3 shadow-(--shadow-card) transition-all duration-200 hover:-translate-y-[2px] hover:shadow-lg sm:gap-4 sm:p-5">
      <div
        className={`h-8 w-8 rounded-xl sm:h-10 sm:w-10 ${accentStyles[accent]} flex shrink-0 items-center justify-center text-white shadow-(--shadow-sm)`}
      >
        {icon}
      </div>

      <div className="flex flex-col leading-tight">
        <p className="font-display text-xl font-bold text-(--foreground) sm:text-2xl">{value}</p>
        <p className="font-body text-xs text-(--muted-foreground)">{label}</p>
      </div>
    </div>
  );
}
