interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: 'navy' | 'orange' | 'success' | 'info' | 'purple' | 'teal' | 'amber';
}

const accentStyles = {
  navy: 'navy-gradient', // Total Elections
  orange: 'bg-kpi-orange', // Ballots
  success: 'bg-success', // Active
  info: 'bg-kpi-blue-light', // Petitions
  purple: 'bg-purple-600', // Admins (Authority)
  teal: 'bg-teal-500', // Groups (Community)
  amber: 'bg-amber-500', // Alternative for Ballots/Alerts
};

export function StatCard({ label, value, accent, icon }: StatCardProps) {
  return (
    <div className="group border-border-color shadow-shadow-card flex items-center gap-3 rounded-xl border bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:gap-4 sm:p-5">
      <div
        className={`h-8 w-8 rounded-xl sm:h-10 sm:w-10 ${accentStyles[accent]} shadow-shadow-sm flex shrink-0 items-center justify-center text-white`}
      >
        {icon}
      </div>

      <div className="flex flex-col leading-tight">
        <p className="font-display text-foreground text-xl font-bold sm:text-2xl">{value}</p>
        <p className="font-body text-muted-foreground text-xs">{label}</p>
      </div>
    </div>
  );
}
