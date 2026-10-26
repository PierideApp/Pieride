import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/EmptyState/EmptyState";
import { Page } from "@/components/Page/Page";
import type { ModulePageProps } from "@/modules/registry";

// L'écran arrive avec le contenu des services (M3 pour PRONOTE).
export function TachesPage({ module }: ModulePageProps) {
  const { t } = useTranslation();
  return (
    <Page title={t("modules.taches")}>
      <EmptyState
        icon={module.icon}
        title={t("placeholder.title")}
        text={t("placeholder.text")}
      />
    </Page>
  );
}
