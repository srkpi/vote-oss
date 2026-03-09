const accentStyles = {
  navy: 'navy-gradient',
  orange: 'bg-[var(--kpi-orange)]',
  success: 'bg-[var(--success)]',
  info: 'bg-[var(--kpi-blue-light)]',
};

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent: 'navy' | 'orange' | 'success' | 'info';
  delay?: number;
}

export function StatCard({ label, value, accent, icon, delay = 0 }: StatCardProps) {
  return (
    <div
      className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] p-4 sm:p-5 animate-fade-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div
        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg ${accentStyles[accent]} flex items-center justify-center text-white shadow-[var(--shadow-sm)] mb-3`}
      >
        {icon}
      </div>
      <p className="font-display text-xl sm:text-2xl font-bold text-[var(--foreground)]">{value}</p>
      <p className="text-xs font-body text-[var(--muted-foreground)] mt-0.5">{label}</p>
    </div>
  );
}
