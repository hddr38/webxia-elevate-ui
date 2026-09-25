import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

const FALLBACK_GRADIENTS = [
  "linear-gradient(135deg, #0b1220 0%, #1e293b 50%, #3b82f6 100%)",
  "linear-gradient(135deg, #1a103d 0%, #4c1d95 50%, #a855f7 100%)",
  "linear-gradient(135deg, #1a1a1a 0%, #3a2a1a 50%, #d4a574 100%)",
  "linear-gradient(135deg, #052e2b 0%, #064e3b 50%, #10b981 100%)",
  "linear-gradient(135deg, #0c0a09 0%, #1c1917 50%, #f59e0b 100%)",
  "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #6366f1 100%)",
];

function hashToIndex(seed: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % max;
}

interface CoverHeroProps {
  eyebrow: string;
  title: string;
  coverUrl?: string | null;
  status: string;
  slug?: string;
  meta?: string | null;
  fallbackSeed: string;
  className?: string;
}

/** Bandeau cover premium (aperçu live) : visuel 21/9 + fallback gradient déterministe. */
export function CoverHero({
  eyebrow,
  title,
  coverUrl,
  status,
  slug,
  meta,
  fallbackSeed,
  className,
}: CoverHeroProps) {
  const fallback =
    FALLBACK_GRADIENTS[hashToIndex(fallbackSeed || "new", FALLBACK_GRADIENTS.length)];
  const hasCover = Boolean(coverUrl && /^https?:\/\/.+/i.test(coverUrl.trim()));

  return (
    <section
      aria-label={title}
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="relative aspect-[21/9] w-full overflow-hidden bg-muted sm:aspect-[28/9]">
        {hasCover ? (
          <img
            src={coverUrl!.trim()}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <>
            <div
              className="absolute inset-0"
              style={{ backgroundImage: fallback }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]"
              aria-hidden="true"
            />
          </>
        )}
        <div className="absolute inset-0 bg-grid opacity-10 mix-blend-overlay" aria-hidden="true" />
        <div
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent p-4 sm:p-5"
          aria-hidden="true"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white backdrop-blur-md">
            <ImageIcon className="size-3" />
            {hasCover ? "Cover" : "Visuel auto"}
          </span>
        </div>
      </div>
      <div className="space-y-2 p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">{eyebrow}</p>
        <h2 className="font-display text-xl font-semibold tracking-tight text-balance sm:text-2xl">
          {title || "—"}
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <StatusBadge status={status} />
          {slug && <span className="font-mono text-xs">/{slug}</span>}
          {meta && <span className="text-xs tabular-nums">{meta}</span>}
        </div>
      </div>
    </section>
  );
}
