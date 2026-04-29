export function RouteContentSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-7 w-56 animate-pulse rounded bg-muted" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted/70" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border bg-muted/40" />
        ))}
      </div>
      <div className="h-[48vh] min-h-[18rem] animate-pulse rounded-lg border bg-muted/40" />
    </div>
  );
}
