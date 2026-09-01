export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-2">
        <div className="h-4 w-32 animate-pulse rounded-md bg-white/10" />
        <div className="h-9 w-64 animate-pulse rounded-xl bg-white/10" />
        <div className="h-4 w-80 animate-pulse rounded-md bg-white/5" />
      </div>

      {/* Main Grid Skeleton */}
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-white/[0.07] bg-[#111113] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 rounded bg-white/10" />
              <div className="h-8 w-8 rounded-xl bg-white/10" />
            </div>
            <div className="h-8 w-36 rounded-lg bg-white/10" />
            <div className="h-3 w-48 rounded bg-white/5" />
          </div>
        ))}
      </div>

      {/* Content Section Skeleton */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="animate-pulse rounded-2xl border border-white/[0.07] bg-[#111113] p-6 space-y-4 lg:col-span-2">
          <div className="h-5 w-40 rounded bg-white/10" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-16 rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
        <div className="animate-pulse rounded-2xl border border-white/[0.07] bg-[#111113] p-6 space-y-4">
          <div className="h-5 w-32 rounded bg-white/10" />
          <div className="h-32 rounded-xl bg-white/5" />
          <div className="h-10 rounded-xl bg-white/10" />
        </div>
      </div>
    </main>
  );
}
