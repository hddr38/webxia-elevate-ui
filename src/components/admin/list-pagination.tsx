import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ListPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  countText: string;
  prevLabel: string;
  nextLabel: string;
  pageLabel: (page: number, totalPages: number) => string;
  onPageChange: (page: number) => void;
}

function pageWindow(page: number, totalPages: number): number[] {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  const pages: number[] = [];
  for (let p = Math.max(1, end - 4); p <= end; p++) pages.push(p);
  return pages;
}

export function ListPagination({
  page,
  totalPages,
  total,
  countText,
  prevLabel,
  nextLabel,
  pageLabel,
  onPageChange,
}: ListPaginationProps) {
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm tabular-nums text-muted-foreground">{countText}</p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {prevLabel}
        </Button>
        {totalPages > 1 &&
          pageWindow(page, totalPages).map((p) => (
            <Button
              key={p}
              variant={p === page ? "default" : "ghost"}
              size="sm"
              aria-current={p === page ? "page" : undefined}
              aria-label={pageLabel(p, totalPages)}
              onClick={() => onPageChange(p)}
              className={cn("min-w-9 tabular-nums", p !== page && "text-muted-foreground")}
            >
              {p}
            </Button>
          ))}
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
