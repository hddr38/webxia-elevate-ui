import { cn } from "@/lib/utils";
import { STATUS_BADGE, STATUS_LABELS } from "@/lib/constants";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
  className?: string;
  children?: React.ReactNode;
}

/** Badge statut pill unifié (draft/published/archived) — vitrine + admin. */
export function StatusBadge({ status, className, children }: StatusBadgeProps) {
  const { t } = useLocale();
  return (
    <Badge
      className={cn(
        "rounded-full border-transparent px-2.5 py-1 text-[11px] font-medium tracking-wide",
        STATUS_BADGE[status] ?? "",
        className,
      )}
    >
      {children ?? t((STATUS_LABELS[status] ?? status) as "status.all")}
    </Badge>
  );
}
