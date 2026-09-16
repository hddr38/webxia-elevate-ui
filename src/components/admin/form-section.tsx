import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  index: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** Section de formulaire premium : carte arrondie, eyebrow numérotée, contenu aéré. */
export function FormSection({ index, title, description, children, className }: FormSectionProps) {
  return (
    <Card className={cn("overflow-hidden rounded-2xl shadow-[var(--shadow-card)]", className)}>
      <CardHeader className="space-y-1.5 pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">{index}</p>
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-5 pt-0">{children}</CardContent>
    </Card>
  );
}
