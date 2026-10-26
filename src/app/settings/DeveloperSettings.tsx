// Développeur, en dev seulement (Settings.tsx) : des données fictives pour travailler sur les
// écrans sans compte scolaire. Le faux service `mock` n'existe pas dans l'app publiée.
import { Sparkles } from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { accountManager } from "@/services";
import { useSyncStore } from "@/stores/sync";

import type { SettingsSectionProps } from "./Settings";
import styles from "./settings.module.scss";

export function DeveloperSettings({ account }: SettingsSectionProps) {
  const { t } = useTranslation();
  const { syncing, sync, reload } = useSyncStore();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!account) {
    return <p className={styles.notice}>{t("settings.developer.noAccount")}</p>;
  }
  // Un seul faux service par compte, retrouvé par son identifiant.
  const serviceId = `mock-${account.id}`;
  const attached = account.kinds.includes("mock");

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setFailed(false);
    try {
      await task();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  // La synchro relit ensuite les comptes : les modules fournis apparaissent.
  const attach = () =>
    run(async () => {
      await accountManager.linkService({
        id: serviceId,
        accountId: account.id,
        kind: "mock",
      });
      await sync(account.id);
    });
  const remove = () =>
    run(async () => {
      await accountManager.unlinkService(serviceId);
      reload();
    });

  return (
    <section className={styles.block} aria-labelledby="settings-mock">
      <h3 id="settings-mock" className={styles.label}>
        {t("settings.developer.mockTitle")}
      </h3>
      <div className={styles.card}>
        <div className={styles.row}>
          <span className={styles.rowIcon} aria-hidden="true">
            <Sparkles size={18} />
          </span>
          <span className={styles.rowText}>
            <strong>
              {attached
                ? t("settings.developer.attached")
                : t("settings.developer.detached")}
            </strong>
            <small>{t("settings.developer.mockText")}</small>
          </span>
          <button
            type="button"
            className={styles.button}
            disabled={busy || syncing}
            onClick={() => void (attached ? remove() : attach())}
          >
            {attached
              ? t("settings.developer.remove")
              : t("settings.developer.attach")}
          </button>
        </div>
      </div>
      {failed && (
        <p className={styles.error} role="alert">
          {t("settings.developer.failed")}
        </p>
      )}
    </section>
  );
}
