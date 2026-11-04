import { Skeleton } from "@/components/ui/skeleton";

export function AdminSkeleton() {
  return (
    <main
      aria-label="Loading admin workspace"
      aria-busy="true"
      className="min-h-screen bg-white px-4 py-6 dark:bg-[#0F172A] sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <section
              key={index}
              className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 shadow-sm dark:border-[#334155] dark:bg-[#1E293B]"
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-4 h-8 w-16" />
            </section>
          ))}
        </div>

        <section className="space-y-5 rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 shadow-sm dark:border-[#334155] dark:bg-[#1E293B]">
          <div className="flex gap-3 border-b border-slate-200 pb-4 dark:border-[#334155]">
            {[0, 1, 2].map((tab) => (
              <Skeleton key={tab} className="h-8 w-28" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#334155] dark:bg-[#0F172A]/50"
              >
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-3 h-3 w-full" />
                <Skeleton className="mt-2 h-3 w-2/3" />
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-[#334155]">
            <div className="flex gap-4 border-b border-slate-200 p-4 dark:border-[#334155]">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="space-y-4 p-4">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="flex items-center gap-4">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
