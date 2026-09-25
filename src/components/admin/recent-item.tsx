import { Link } from "@tanstack/react-router";
import { Eye, type LucideIcon } from "lucide-react";
import { StatusBadge } from "./status-badge";

interface RecentItemProps {
  id: string;
  title: string;
  subtitle?: string | null;
  status: string;
  statusLabel: string;
  dateLabel: string;
  coverUrl?: string | null;
  fallbackIcon: LucideIcon;
  editTo: "/admin/articles/$id" | "/admin/realisations/$id";
  viewTo?: "/journal/$slug" | "/work/$slug";
  viewSlug?: string;
  viewLabel: string;
}

/** Ligne riche des listes récentes du dashboard : vignette, textes, statut, accès vitrine. */
export function RecentItem({
  id,
  title,
  subtitle,
  status,
  statusLabel,
  dateLabel,
  coverUrl,
  fallbackIcon: FallbackIcon,
  editTo,
  viewTo,
  viewSlug,
  viewLabel,
}: RecentItemProps) {
  const hasCover = Boolean(coverUrl && /^https?:\/\/.+/i.test(coverUrl.trim()));
  const canView =
    viewTo !== undefined &&
    viewSlug !== undefined &&
    viewSlug.trim() !== "" &&
    status === "published";

  return (
    <li className="group flex items-center gap-1 rounded-xl transition-colors hover:bg-foreground/[0.04]">
      <Link
        to={editTo}
        params={{ id }}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {hasCover ? (
          <img
            src={coverUrl!.trim()}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="size-10 shrink-0 rounded-lg bg-muted object-cover"
          />
        ) : (
          <span
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
            aria-hidden="true"
          >
            <FallbackIcon className="size-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          {subtitle && (
            <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
          )}
          <span className="block text-xs tabular-nums text-muted-foreground">{dateLabel}</span>
        </span>
        <StatusBadge status={status} className="shrink-0">
          {statusLabel}
        </StatusBadge>
      </Link>
      {canView && (
        <Link
          to={viewTo}
          params={{ slug: viewSlug }}
          target="_blank"
          aria-label={viewLabel}
          className="mr-1 inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all hover:bg-foreground/[0.06] hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
        >
          <Eye className="size-4" aria-hidden="true" />
        </Link>
      )}
    </li>
  );
}
