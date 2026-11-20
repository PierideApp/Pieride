// La ligne « Mises à jour » de Démarrage et fenêtre (maquette 12) : la version installée, où
// en est la recherche, et le bouton qui convient à l'état (rechercher, installer, redémarrer).
import { getVersion } from "@tauri-apps/api/app";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { useLoaded } from "@/hooks/useLoaded";
import { openLink } from "@/lib/links";
import { report } from "@/lib/log";
import { useUpdateStore } from "@/stores/update";

import { Card } from "@/components/Card/Card";
import { AlertCircle, ArrowDownBox, Check, InfoBox } from "@getpapillon/papicons";

export function UpdateRow() {
  const { t, i18n } = useTranslation();
  const version = useLoaded(getVersion, "version");
  const { state, check, install, restart } = useUpdateStore();
  const busy = state.status === "checking" || state.status === "downloading";

  const text =
    state.status === "upToDate"
      ? t("settings.updater.upToDate", {
          time: new Intl.DateTimeFormat(i18n.language, {
            timeStyle: "short",
          }).format(state.checkedAt),
        })
      : state.status === "checking"
        ? t("settings.updater.checking")
        : state.status === "available"
          ? t(
              state.manual
                ? "settings.updater.availableManual"
                : "settings.updater.available",
              { version: state.version }
            )
          : state.status === "downloading"
            ? t("settings.updater.downloading", {
                percent:
                  state.progress === null
                    ? "…"
                    : `${Math.round(state.progress * 100)} %`,
              })
            : state.status === "ready"
              ? t("settings.updater.ready", { version: state.version })
              : state.status === "error"
                ? t("settings.updater.updateFailed")
                : t("settings.updater.notChecked");

  return (
    <Card rows tone={
      state.status === "error" ? "danger" :
      state.status === "available" ? "warn" :
      state.status === "upToDate" ? "success" :
      undefined
    } style={{ marginBottom: "10px" }}>
      <SettingRow
        icon={
          state.status === "error" ? AlertCircle :
          state.status === "available" ? ArrowDownBox :
          state.status === "upToDate" ? Check : InfoBox
        }
        title={<span role="status">{text}</span>}
        text={
          state.status === "upToDate" && t("settings.updater.checkedAt", {
            time: new Intl.DateTimeFormat(i18n.language, {
              timeStyle: "short",
            }).format(state.checkedAt),
          })
        }
      >
        {state.status === "available" && state.manual ? (
          <Button
            variant="primary"
            onClick={() =>
              openLink("releases").catch((error: unknown) =>
                report("update", error)
              )
            }
          >
            {t("settings.updater.releases")}
          </Button>
        ) : state.status === "available" ? (
          <Button variant="primary" onClick={install}>
            {t("settings.updater.install")}
          </Button>
        ) : state.status === "ready" ? (
          <Button variant="primary" onClick={restart}>
            {t("settings.updater.restart")}
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => check()}>
            {t("settings.updater.check")}
          </Button>
        )}
      </SettingRow>
    </Card>
  );
}
