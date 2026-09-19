export function ElectionCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="animate-fade-up border-border-color bg-card overflow-hidden rounded-xl border"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
    >
      <div className="skeleton h-1" />
      <div className="space-y-4 p-6">
        <div className="skeleton h-5 w-24 rounded-full" />
        <div className="space-y-2">
          <div className="skeleton h-6 w-3/4 rounded" />
          <div className="skeleton h-4 w-1/2 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-20 rounded-full" />
          <div className="skeleton h-6 w-14 rounded-full" />
        </div>
        <div className="skeleton h-px w-full" />
        <div className="flex justify-between">
          <div className="skeleton h-4 w-20 rounded" />
          <div className="skeleton h-4 w-24 rounded" />
        </div>
      </div>
    </div>
  );
}
