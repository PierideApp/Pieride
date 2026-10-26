// Adresse inconnue, ou module caché pour le compte en cours (docs/modules.md).
import { Ghost } from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { EmptyState } from "@/components/EmptyState/EmptyState";
import { Page } from "@/components/Page/Page";

export function NotFound() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Page title={t("notFound.heading")}>
      <EmptyState
        icon={Ghost}
        backdrop="404"
        title={t("notFound.title")}
        text={t("notFound.text")}
        action={{
          label: t("notFound.back"),
          onClick: () => void navigate("/"),
        }}
      />
    </Page>
  );
}
