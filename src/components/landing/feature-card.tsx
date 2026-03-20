interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="group border-border-subtle shadow-shadow-sm hover:shadow-shadow-md rounded-xl border bg-white p-6 transition-all duration-300 hover:-translate-y-0.5">
      <div className="mb-4 flex items-center">
        <div className="navy-gradient mr-4 flex h-12 w-12 items-center justify-center rounded-xl text-white transition-transform duration-300 group-hover:scale-105">
          {icon}
        </div>
        <h3 className="font-display text-foreground text-lg font-semibold">{title}</h3>
      </div>
      <p className="font-body text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}
