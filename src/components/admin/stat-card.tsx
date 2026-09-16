import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  to: string;
  title: string;
  value: number;
  icon: LucideIcon;
  details?: ReactNode;
  loading?: boolean;
  ariaLabel?: string;
}

export function StatCard({
  to,
  title,
  value,
  icon: Icon,
  details,
  loading,
  ariaLabel,
}: StatCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-5" aria-hidden="true">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="size-9 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="mt-4 h-8 w-16 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-3 w-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      className={cn(
        "group flex flex-col rounded-xl border bg-card p-5 transition-colors duration-200 motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "hover:border-brand/40",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between">
        <span className="text-3xl font-semibold tabular-nums tracking-tight">{value}</span>
        <ArrowUpRight
          className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </div>
      {details && <p className="mt-3 text-xs text-muted-foreground">{details}</p>}
    </Link>
  );
}
