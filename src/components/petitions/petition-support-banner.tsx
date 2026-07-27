interface PetitionSupportBannerProps {
  ballotCount: number;
  quorum: number;
}

export function PetitionSupportBanner({ ballotCount, quorum }: PetitionSupportBannerProps) {
  const progress = quorum > 0 ? Math.min(100, Math.round((ballotCount / quorum) * 100)) : 0;

  return (
    <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-6">
      <h2 className="font-body mb-3 text-sm font-semibold">Підтримка петиції</h2>
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="bg-accent h-2 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-muted-foreground text-sm">
        {ballotCount} з {quorum} підписів ({progress}%)
      </p>
    </div>
  );
}
