import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
  fallbackTo: string;
  label: string;
}

export function BackButton({ fallbackTo, label }: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) {
      window.history.back();
    } else {
      void navigate({ to: fallbackTo });
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-9 gap-2 text-muted-foreground hover:text-foreground"
      onClick={handleClick}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
