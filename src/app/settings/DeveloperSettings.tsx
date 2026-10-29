// Développeur (maquette 15-developpeur) : le journal et les requêtes réseau depuis le
// lancement, en mémoire seulement (lib/log.ts), pour comprendre un problème et le signaler.
// En dev, des données fictives pour travailler sur les écrans sans compte scolaire : le faux
// service `mock` n'existe pas dans l'app publiée.
import { Globe, Sparkles } from "@getpapillon/papicons";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { Notice } from "@/components/Notice/Notice";
import { Section } from "@/components/Section/Section";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { getLog, logText, subscribeLog } from "@/lib/log";
import { accountManager } from "@/services";
import { useSyncStore } from "@/stores/sync";

import type { SettingsSectionProps } from "./Settings";
import styles from "./settings.module.scss";

/** Données fictives attachées au compte affiché (en dev seulement). */
function MockData({ account }: SettingsSectionProps) {
  const { t } = useTranslation();
  const { syncing, sync, reload } = useSyncStore();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!account) {
    return <Notice>{t("settings.developer.noAccount")}</Notice>;
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
    <Section title={t("settings.developer.mockTitle")}>
      <Card>
        <SettingRow
          icon={Sparkles}
          title={
            attached
              ? t("settings.developer.attached")
              : t("settings.developer.detached")
          }
          text={t("settings.developer.mockText")}
        >
          <Button
            disabled={busy || syncing}
            onClick={() => void (attached ? remove() : attach())}
          >
            {attached
              ? t("settings.developer.remove")
              : t("settings.developer.attach")}
          </Button>
        </SettingRow>
      </Card>
      {failed && (
        <p className={styles.error} role="alert">
          {t("settings.developer.failed")}
        </p>
      )}
    </Section>
  );
}

export function DeveloperSettings(props: SettingsSectionProps) {
  const { t, i18n } = useTranslation();
  const { entries, requests, requestCount } = useSyncExternalStore(
    subscribeLog,
    getLog
  );
  const [showRequests, setShowRequests] = useState(false);
  const [copy, setCopy] = useState<"done" | "failed" | null>(null);
  const time = new Intl.DateTimeFormat(i18n.language, { timeStyle: "medium" });

  return (
    <>
      <Section title={t("settings.developer.network")}>
        <Card>
          <SettingRow
            icon={Globe}
            title={t("settings.developer.requests")}
            text={t("settings.developer.requestCount", { count: requestCount })}
          >
            <Button
              aria-expanded={showRequests}
              disabled={requests.length === 0}
              onClick={() => setShowRequests(!showRequests)}
            >
              {showRequests
                ? t("settings.developer.hide")
                : t("settings.developer.show")}
            </Button>
          </SettingRow>
          {showRequests && (
            <table className={styles.requests}>
              <thead>
                <tr>
                  <th>{t("settings.developer.time")}</th>
                  <th>{t("settings.developer.method")}</th>
                  <th>{t("settings.developer.host")}</th>
                  <th>{t("settings.developer.status")}</th>
                  <th>{t("settings.developer.duration")}</th>
                </tr>
              </thead>
              <tbody>
                {[...requests].reverse().map(request => (
                  <tr key={request.id}>
                    <td>{time.format(request.time)}</td>
                    <td>{request.method}</td>
                    <td>{request.host}</td>
                    <td
                      data-failed={
                        request.status === undefined ||
                        request.status >= 400 ||
                        undefined
                      }
                    >
                      {request.status ?? t("settings.developer.noResponse")}
                    </td>
                    <td>{Math.round(request.duration)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </Section>

      {import.meta.env.DEV && <MockData {...props} />}

      <Section
        title={t("settings.developer.log")}
        aside={
          <Button
            variant="link"
            disabled={entries.length === 0}
            onClick={() =>
              navigator.clipboard.writeText(logText()).then(
                () => setCopy("done"),
                () => setCopy("failed")
              )
            }
          >
            {copy === "done"
              ? t("settings.developer.copied")
              : t("settings.developer.copy")}
          </Button>
        }
      >
        <ol className={styles.log} aria-live="polite">
          {entries.length === 0 && <li>{t("settings.developer.emptyLog")}</li>}
          {[...entries].reverse().map(entry => (
            <li key={entry.id}>
              <time>{time.format(entry.time)}</time>
              <span data-level={entry.level}>{entry.level.toUpperCase()}</span>
              <span>{entry.source}</span>
              <span>{entry.message}</span>
            </li>
          ))}
        </ol>
        {copy === "failed" && (
          <p className={styles.error} role="alert">
            {t("settings.developer.copyFailed")}
          </p>
        )}
        <p className={styles.hint}>{t("settings.developer.private")}</p>
      </Section>
    </>
  );
}
