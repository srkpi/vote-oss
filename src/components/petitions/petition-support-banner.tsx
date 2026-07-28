import { Users } from 'lucide-react';

interface PetitionSupportBannerProps {
  ballotCount: number;
  quorum: number;
}

export function PetitionSupportBanner({ ballotCount, quorum }: PetitionSupportBannerProps) {
  const progress = quorum > 0 ? Math.min(100, Math.round((ballotCount / quorum) * 100)) : 0;
  const reached = progress >= 100;

  return (
    <div className="border-border-color shadow-card rounded-xl border bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-body flex items-center gap-2 text-sm font-semibold">
          <Users className="text-muted-foreground h-4 w-4" />
          Підтримка петиції
        </h2>
        <span
          className={reached ? 'text-success text-sm font-bold' : 'text-kpi-navy text-sm font-bold'}
        >
          {progress}%
        </span>
      </div>
      <div className="bg-border-subtle mb-2.5 h-2.5 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            reached
              ? 'from-success bg-linear-to-r to-emerald-400'
              : 'from-kpi-orange to-kpi-orange-dark bg-linear-to-r'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-muted-foreground text-sm">
        <span className="text-foreground font-semibold">{ballotCount}</span> з {quorum} підписів
      </p>
    </div>
  );
}
