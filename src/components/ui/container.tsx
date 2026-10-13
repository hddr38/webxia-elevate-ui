import type { ComponentPropsWithRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Largeurs de conteneur du site public.
 *
 * - `wide` / `narrow` : les deux rôles stables (grille vs lecture).
 * - `gallery` : exception délibérée de la galerie `$slug`, qui conserve
 *   `max-w-5xl` après harmonisation des largeurs (LOT 3 / D3-Q4).
 */
export type ContainerSize = "wide" | "narrow" | "gallery";

const SIZE_MAP: Record<ContainerSize, string> = {
  wide: "max-w-7xl",
  narrow: "max-w-3xl",
  gallery: "max-w-5xl",
};

export type ContainerProps = ComponentPropsWithRef<"div"> & {
  size: ContainerSize;
};

/**
 * Boîte de mise en page centrée (`mx-auto`) à largeur plafonnée.
 *
 * Rend un `<div>` simple et transmet toutes les propriétés HTML restantes
 * (attributs, `aria-*`, `data-*`, événements, `ref`). L'alignement et la
 * largeur sont portés par `size` ; les classes restantes (paddings, marges,
 * breakpoints, rôles) passent par `className`.
 */
export function Container({ size, className, children, ...props }: ContainerProps) {
  return (
    <div {...props} className={cn("mx-auto w-full", SIZE_MAP[size], className)}>
      {children}
    </div>
  );
}
