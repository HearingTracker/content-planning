import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Skeleton className="h-3 w-40" />
      <div className="overflow-hidden rounded-xl border bg-card">
        <Skeleton className="h-px w-full rounded-none" />
        <div className="space-y-3 px-6 pt-6 pb-5">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <div className="grid grid-cols-2 gap-px border-t bg-border sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 bg-card px-5 py-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="hidden space-y-3 lg:block">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
