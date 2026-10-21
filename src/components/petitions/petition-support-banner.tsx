import { Users } from 'lucide-react';

interface PetitionSupportBannerProps {
  ballotCount: number;
  quorum: number;
}

export function PetitionSupportBanner({ ballotCount, quorum }: PetitionSupportBannerProps) {
  const progress = quorum > 0 ? Math.min(100, Math.round((ballotCount / quorum) * 100)) : 0;
  const reached = progress >= 100;

  return (
    <div className="border-border-color rounded-xl border bg-card p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-body flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-muted-foreground" />
          Підтримка петиції
        </h2>
        <span
          className={reached ? 'text-sm font-bold text-success' : 'text-sm font-bold text-kpi-navy'}
        >
          {progress}%
        </span>
      </div>
      <div className="mb-2.5 h-2.5 overflow-hidden rounded-full bg-border-subtle">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            reached
              ? 'bg-linear-to-r from-success to-emerald-400'
              : 'bg-linear-to-r from-kpi-orange to-kpi-orange-dark'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{ballotCount}</span> з {quorum} підписів
      </p>
    </div>
  );
}
