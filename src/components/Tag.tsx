import type { ReactNode } from 'react';

/** Small pill for listing amenity tags. */
export default function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
      {children}
    </span>
  );
}
