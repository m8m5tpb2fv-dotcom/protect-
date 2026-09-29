import { ProviderCardSkeleton } from "@/components/domain/provider-card";

/** Generic route skeleton (streams instantly while server data loads). */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-32 pt-4 lg:px-6 lg:pt-10" aria-busy="true" aria-label="Загрузка">
      <div className="skeleton h-10 w-2/3 max-w-md rounded-2xl" />
      <div className="skeleton mt-3 h-5 w-1/2 max-w-sm rounded-xl" />
      <div className="skeleton mt-6 h-14 max-w-3xl rounded-full" />
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <ProviderCardSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}
