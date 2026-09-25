import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ListErrorBannerProps {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}

export function ListErrorBanner({ message, retryLabel, onRetry }: ListErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm"
    >
      <span className="inline-flex items-center gap-2 text-destructive">
        <TriangleAlert className="h-4 w-4" aria-hidden="true" />
        {message}
      </span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}
