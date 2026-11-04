import { Skeleton } from "@/components/ui/skeleton";

export function DashboardContentSkeleton() {
  return (
    <div aria-label="Loading dashboard" aria-busy="true" className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <section
            key={index}
            className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 shadow-sm dark:border-[#334155] dark:bg-[#1E293B]"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-8 w-36" />
            <Skeleton className="mt-3 h-3 w-20" />
          </section>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((chart) => (
          <section
            key={chart}
            className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 shadow-sm dark:border-[#334155] dark:bg-[#1E293B]"
          >
            <Skeleton className="h-5 w-48" />
            <div className="mt-6 flex h-56 items-end gap-3">
              {[44, 66, 52, 82, 60, 94, 70].map((height, index) => (
                <Skeleton
                  key={index}
                  className="flex-1 rounded-t-md rounded-b-none"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-[#F8FAFC] shadow-sm dark:border-[#334155] dark:bg-[#1E293B]">
        <div className="border-b border-slate-200 p-5 dark:border-[#334155]">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <div className="space-y-4 p-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <main className="min-h-screen bg-white px-4 py-6 dark:bg-[#0F172A] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <DashboardContentSkeleton />
      </div>
    </main>
  );
}
