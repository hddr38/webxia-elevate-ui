import { useLocale } from "@/lib/locale-context";

export function Footer() {
  const { t } = useLocale();
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
        <div>{t("footer.tag")}</div>
        <div>© {new Date().getFullYear()} WebXIA. {t("footer.rights")}</div>
      </div>
    </footer>
  );
}
