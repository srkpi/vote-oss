const accentStyles = {
  navy: 'navy-gradient',
  orange: 'bg-[var(--kpi-orange)]',
  success: 'bg-[var(--success)]',
  info: 'bg-[var(--kpi-blue-light)]',
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: 'navy' | 'orange' | 'success' | 'info';
  delay?: number;
}

export function StatCard({ label, value, accent, icon, delay = 0 }: StatCardProps) {
  return (
    <div
      className="
        group
        flex items-center gap-3 sm:gap-4
        bg-white
        rounded-[var(--radius-xl)]
        border border-[var(--border-color)]
        shadow-[var(--shadow-card)]
        p-3 sm:p-5
        transition-all duration-200
        hover:shadow-lg hover:-translate-y-[2px]
      "
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div
        className={`
          w-8 h-8
          sm:w-10 sm:h-10
          rounded-xl
          ${accentStyles[accent]}
          flex items-center justify-center
          text-white
          shadow-[var(--shadow-sm)]
          shrink-0
        `}
      >
        {icon}
      </div>

      <div className="flex flex-col leading-tight">
        <p className="font-display text-xl sm:text-2xl font-bold text-[var(--foreground)]">
          {value}
        </p>
        <p className="text-xs font-body text-[var(--muted-foreground)]">{label}</p>
      </div>
    </div>
  );
}
