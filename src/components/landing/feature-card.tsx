interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="p-6 rounded-[var(--radius-xl)] bg-white border border-[var(--border-subtle)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all duration-300 group">
      <div className="flex items-center mb-4">
        <div className="w-12 h-12 rounded-xl navy-gradient flex items-center justify-center text-white mr-4 group-hover:scale-105 transition-transform duration-300">
          {icon}
        </div>
        <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">{title}</h3>
      </div>
      <p className="text-sm text-[var(--muted-foreground)] font-body leading-relaxed">
        {description}
      </p>
    </div>
  );
}
