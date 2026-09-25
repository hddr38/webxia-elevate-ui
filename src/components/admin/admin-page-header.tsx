import type { ReactNode } from "react";
import { BackButton } from "./back-button";
import { useLocale } from "@/lib/locale-context";

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  backTo?: string;
}

export function AdminPageHeader({ title, description, actions, backTo }: AdminPageHeaderProps) {
  const { t } = useLocale();

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        {backTo && (
          <div>
            <BackButton fallbackTo={backTo} label={t("admin.common.back")} />
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="max-w-[65ch] text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
