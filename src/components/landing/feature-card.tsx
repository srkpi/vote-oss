interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="group rounded-xl border border-(--border-subtle) bg-white p-6 shadow-(--shadow-sm) transition-all duration-300 hover:-translate-y-0.5 hover:shadow-(--shadow-md)">
      <div className="mb-4 flex items-center">
        <div className="navy-gradient mr-4 flex h-12 w-12 items-center justify-center rounded-xl text-white transition-transform duration-300 group-hover:scale-105">
          {icon}
        </div>
        <h3 className="font-display text-lg font-semibold text-(--foreground)">{title}</h3>
      </div>
      <p className="font-body text-sm leading-relaxed text-(--muted-foreground)">{description}</p>
    </div>
  );
}
