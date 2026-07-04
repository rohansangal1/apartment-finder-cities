/** Loading placeholder that mirrors the new ListingCard silhouette (visual header
 * + data stack). Uses dark ink pulses so it reads as an empty card on the
 * near-black canvas rather than the light-theme slate blocks. */
export default function ListingSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="h-32 animate-pulse bg-ink-700 sm:h-36" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-1/2 animate-pulse rounded bg-ink-700" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-ink-700" />
        <div className="flex gap-2">
          <div className="h-5 w-16 animate-pulse rounded-full bg-ink-700" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-ink-700" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-ink-700" />
        </div>
        <div className="h-10 w-full animate-pulse rounded-lg bg-ink-700" />
      </div>
    </div>
  );
}
