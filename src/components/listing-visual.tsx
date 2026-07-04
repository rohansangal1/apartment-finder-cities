import { useMemo, useState } from 'react';
import type { Listing } from '../lib/types';

/**
 * Card/detail imagery for a listing. RentCast and friends often ship no photos,
 * so this renders a real <img> when one is present and falls back to a
 * deterministic, generated SVG otherwise — every listing gets distinctive,
 * on-brand imagery and we never show a broken image (onError also flips to the
 * fallback if a real photo fails to load).
 *
 * The fallback is seeded by hash(listing.id) so the same listing always draws
 * the same abstract roofline/window-grid; the accent tint follows the match
 * score band when one is provided (matching MatchScore's thresholds), else a
 * hash-picked brand/terracotta/muted hue.
 */

/** FNV-1a — small, stable, dependency-free string hash. */
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Accent hue for the generated fallback: score band when known, else hashed. */
function accentFor(id: string, score?: number): string {
  if (score != null) {
    if (score >= 80) return '#34d399'; // emerald
    if (score >= 60) return '#4C8B67'; // brand green
    if (score >= 40) return '#fbbf24'; // amber
    return '#8B857D'; // muted
  }
  const palette = ['#4C8B67', '#D98A64', '#8B857D']; // brand / terracotta / muted
  return palette[hash(id) % palette.length];
}

/** A deterministic inline SVG data URI: warm-dark base, tinted gradient, and a
 * hash-seeded roofline + window grid at low opacity. No network, no deps. */
function fallbackSvg(id: string, score?: number): string {
  const h = hash(id);
  const accent = accentFor(id, score);
  // Tint strength ~12–18% depending on the hash.
  const tintOpacity = (0.12 + (h % 7) * 0.01).toFixed(2);

  // Seeded pseudo-random stream from the hash.
  let seed = h;
  const rand = () => {
    seed = (seed * 1664525 + 1013904319) >>> 0;
    return seed / 0xffffffff;
  };

  // Rooflines: a few staggered building silhouettes across the bottom.
  const buildings = 4 + (h % 3);
  let roofs = '';
  const slotW = 400 / buildings;
  for (let i = 0; i < buildings; i++) {
    const bw = slotW * (0.55 + rand() * 0.35);
    const bx = i * slotW + (slotW - bw) / 2;
    const bh = 40 + rand() * 90;
    const by = 220 - bh;
    roofs += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(
      1
    )}" height="${bh.toFixed(1)}" fill="${accent}" opacity="0.10" rx="2"/>`;
    // A sparse window grid on each building.
    const cols = 2 + Math.floor(rand() * 2);
    const rows = 2 + Math.floor(rand() * 3);
    const pad = bw * 0.16;
    const cw = (bw - pad * 2) / cols;
    const ch = (bh - pad * 2) / rows;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rand() < 0.35) continue; // some windows dark
        const wx = bx + pad + c * cw + cw * 0.2;
        const wy = by + pad + r * ch + ch * 0.2;
        roofs += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${(
          cw * 0.55
        ).toFixed(1)}" height="${(ch * 0.55).toFixed(1)}" fill="${accent}" opacity="0.16" rx="1"/>`;
      }
    }
  }

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='220' viewBox='0 0 400 220'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='${accent}' stop-opacity='${tintOpacity}'/>
      <stop offset='1' stop-color='${accent}' stop-opacity='0'/>
    </linearGradient>
  </defs>
  <rect width='400' height='220' fill='#141210'/>
  <rect width='400' height='220' fill='url(#g)'/>
  ${roofs}
</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default function ListingVisual({
  listing,
  score,
  className = '',
}: {
  listing: Listing;
  score?: number;
  className?: string;
}) {
  const photo = listing.photos?.[0];
  const [failed, setFailed] = useState(false);
  const fallback = useMemo(() => fallbackSvg(listing.id, score), [listing.id, score]);

  const showPhoto = photo && !failed;

  return (
    <div className={`relative h-full w-full overflow-hidden bg-ink-900 ${className}`}>
      <img
        src={showPhoto ? photo : fallback}
        alt=""
        aria-hidden="true"
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
      {/* Bottom scrim so overlaid score/save controls stay legible over any photo. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
    </div>
  );
}
