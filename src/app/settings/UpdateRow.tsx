// La ligne « Mises à jour » de Démarrage et fenêtre (maquette 12) : la version installée, où
// en est la recherche, et le bouton qui convient à l'état (rechercher, installer, redémarrer).
import { AlertCircle, ArrowDownBox, Check, InfoBox } from "@getpapillon/papicons";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { ProgressBar } from "@/components/ProgressBar/ProgressBar";
import { openLink } from "@/lib/links";
import { report } from "@/lib/log";
import { platformName } from "@/lib/platform";
import { useUpdateStore } from "@/stores/update";
import { sizeFormater } from "@/lib/sizeFormater";

export function UpdateRow() {
  const { t, i18n } = useTranslation();
  const { state, check, downloadAndInstall, install, restart } = useUpdateStore();
  const busy = state.status === "checking" || state.status === "downloading";
  const isWindows = platformName === "Windows";

  const text = (() => {
    switch (state.status) {
      case "upToDate":
        return t("settings.updater.upToDate", {
          time: new Intl.DateTimeFormat(i18n.language, {
            timeStyle: "short",
          }).format(state.checkedAt),
        });

      case "checking":
        return t("settings.updater.checking");

      case "available":
        return t(
          state.manual
            ? "settings.updater.availableManual"
            : "settings.updater.available",
          { version: state.version }
        );

      case "downloading":
        return t("settings.updater.downloading", {
          percent:
            state.progress === null
              ? ""
              : `${sizeFormater(state.done)} / ${sizeFormater(state.total)} - ${Math.round(state.progress * 100)} %`,
        });

      case "installing":
        return t("settings.updater.installing", { version: state.version });

      case "installReady":
        return t("settings.updater.installReady", { version: state.version });

      case "restartReady":
        return t("settings.updater.restartReady", { version: state.version });

      case "error":
        return t("settings.updater.updateFailed");

      default:
        return t("settings.updater.notChecked");
      }
  })();

  return (
    <Card rows tone={
      state.status === "error" ? "danger" :
      ["available", "installReady", "restartReady"].includes(state.status) ? "warn" :
      state.status === "upToDate" ? "success" :
      undefined
    } style={{ marginBottom: "10px" }}>
      <SettingRow
        icon={
          state.status === "error" ? AlertCircle :
          ["available", "installReady", "restartReady"].includes(state.status) ? ArrowDownBox :
          state.status === "upToDate" ? Check : InfoBox
        }
        title={<span role="status">{text}</span>}
        text={
          state.status === "upToDate" ? t("settings.updater.checkedAt", {
            time: new Intl.DateTimeFormat(i18n.language, {
              timeStyle: "short",
            }).format(state.checkedAt),
          }) : state.status === "downloading" ? (
            <ProgressBar progress={state.progress === null ? 0 : state.progress * 100} />
          ) : ["checking", "installing"].includes(state.status) && (
            <ProgressBar progress={null} />
          )
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
          <Button variant="primary" onClick={() => { downloadAndInstall(); }}>
            {t(isWindows ? "settings.updater.download" : "settings.updater.downloadAndInstall")}
          </Button>
        ) : state.status === "installReady" ? (
          <Button variant="primary" onClick={install}>
            {t("settings.updater.restartAndInstall")}
          </Button>
        ) : state.status === "restartReady" ? (
          <Button variant="primary" onClick={restart}>
            {t("settings.updater.restart")}
          </Button>
        ) : ["checking", "upToDate", "error", "idle"].includes(state.status) && (
          <Button disabled={busy} onClick={() => check()}>
            {t("settings.updater.check")}
          </Button>
        )}
      </SettingRow>
    </Card>
  );
}
