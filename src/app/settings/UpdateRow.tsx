// La ligne « Mises à jour » de Démarrage et fenêtre (maquette 12) : la version installée, où
// en est la recherche, et le bouton qui convient à l'état (rechercher, installer, redémarrer).
import { getVersion } from "@tauri-apps/api/app";
import { useTranslation } from "react-i18next";

import icon from "@/assets/brand/icon.svg";
import { Button } from "@/components/Button/Button";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { useLoaded } from "@/hooks/useLoaded";
import { openLink } from "@/lib/links";
import { report } from "@/lib/log";
import { useUpdateStore } from "@/stores/update";

import styles from "./settings.module.scss";

export function UpdateRow() {
  const { t, i18n } = useTranslation();
  const version = useLoaded(getVersion, "version");
  const { state, check, install, restart } = useUpdateStore();
  const busy = state.status === "checking" || state.status === "downloading";

  const text =
    state.status === "upToDate"
      ? t("settings.startup.upToDate", {
          time: new Intl.DateTimeFormat(i18n.language, {
            timeStyle: "short",
          }).format(state.checkedAt),
        })
      : state.status === "checking"
        ? t("settings.startup.checking")
        : state.status === "available"
          ? t(
              state.manual
                ? "settings.startup.availableManual"
                : "settings.startup.available",
              { version: state.version }
            )
          : state.status === "downloading"
            ? t("settings.startup.downloading", {
                percent:
                  state.progress === null
                    ? "…"
                    : `${Math.round(state.progress * 100)} %`,
              })
            : state.status === "ready"
              ? t("settings.startup.ready", { version: state.version })
              : state.status === "error"
                ? t("settings.startup.updateFailed")
                : t("settings.startup.notChecked");

  return (
    <SettingRow
      media={
        <img
          src={icon}
          alt=""
          width={44}
          height={44}
          className={styles.appIcon}
        />
      }
      title={t("settings.startup.version", {
        version: version.status === "ready" ? version.data : "",
      })}
      text={<span role="status">{text}</span>}
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
          {t("settings.startup.releases")}
        </Button>
      ) : state.status === "available" ? (
        <Button variant="primary" onClick={install}>
          {t("settings.startup.install")}
        </Button>
      ) : state.status === "ready" ? (
        <Button variant="primary" onClick={restart}>
          {t("settings.startup.restart")}
        </Button>
      ) : (
        <Button disabled={busy} onClick={() => check()}>
          {t("settings.startup.check")}
        </Button>
      )}
    </SettingRow>
  );
}
