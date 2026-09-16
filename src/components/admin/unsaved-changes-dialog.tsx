import { useBlocker } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocale } from "@/lib/locale-context";

interface UnsavedChangesDialogProps {
  when: boolean;
}

/**
 * Bloque la navigation interne (et le rechargement via beforeunload)
 * tant que le formulaire a des modifications non enregistrées.
 */
export function UnsavedChangesDialog({ when }: UnsavedChangesDialogProps) {
  const { t } = useLocale();
  const blocker = useBlocker({
    shouldBlockFn: () => when,
    enableBeforeUnload: when,
    withResolver: true,
  });

  if (blocker.status !== "blocked") return null;

  return (
    <AlertDialog open onOpenChange={(open) => !open && blocker.reset()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("admin.common.unsavedTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("admin.common.unsavedDesc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset()}>
            {t("admin.common.unsavedStay")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => blocker.proceed()}
            className="bg-red-600 hover:bg-red-700"
          >
            {t("admin.common.unsavedLeave")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
