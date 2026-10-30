// Le parcours PRONOTE, chargé à la demande : pawnote et ses dépendances (node-forge, pako…)
// pèsent plusieurs centaines de Ko et ne servent qu'à se connecter. Les écrans l'importent
// d'ici : un import direct de `PronoteFlow` ou de `@/services/pronote` les remettrait dans le
// bundle chargé à chaque lancement.
import { type ComponentProps, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";

import { Spinner } from "@/components/Spinner/Spinner";

const Flow = lazy(() =>
  import("./PronoteFlow").then(module => ({ default: module.PronoteFlow }))
);

export function PronoteFlow(props: ComponentProps<typeof Flow>) {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<Spinner size="large" label={t("app.loading")} />}>
      <Flow {...props} />
    </Suspense>
  );
}
