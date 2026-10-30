// Comptes liés (maquette 02-comptes-lies) : les comptes scolaires, puis les services de
// cantine et les calendriers liés à chacun. On change de compte, on en supprime un (données
// et secrets compris), on délie un service, on ajoute un compte.
// Un compte PRONOTE refusé se reconnecte ici. « Ajouter un calendrier » arrive avec iCal (M4).
import { AlertTriangle, Plus, User } from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ActionMenu } from "@/components/ActionMenu/ActionMenu";
import { Avatar } from "@/components/Avatar/Avatar";
import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { Chip } from "@/components/Chip/Chip";
import { ConfirmDialog } from "@/components/ConfirmDialog/ConfirmDialog";
import { Section } from "@/components/Section/Section";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import type { AccountService, AccountSummary } from "@/hooks/useAccounts";
import { report } from "@/lib/log";
import { accountManager } from "@/services";
import { SERVICE_GROUPS, SERVICE_NAMES } from "@/services/shared/plugin";
import { removeAccount, useAccountStore } from "@/stores/accounts";
import { useSyncStore } from "@/stores/sync";

import { AddAccountDialog, type AddAccountStart } from "./AddAccountDialog";
import type { SettingsSectionProps } from "./Settings";
import styles from "./settings.module.scss";

/** Les services d'un groupe (cantine, calendriers), avec le compte auquel ils sont liés. */
function ServiceList({
  accounts,
  group,
  onUnlink,
}: {
  accounts: AccountSummary[];
  group: "canteen" | "calendar";
  onUnlink: (service: AccountService, owner: AccountSummary) => void;
}) {
  const { t } = useTranslation();
  const rows = accounts.flatMap(owner =>
    owner.services
      .filter(service => SERVICE_GROUPS[service.kind] === group)
      .map(service => ({ service, owner }))
  );
  if (rows.length === 0) {
    return null;
  }
  return (
    <Section title={t(`settings.linked.${group}`)}>
      <Card as="ul" rows>
        {rows.map(({ service, owner }) => (
          <SettingRow
            key={service.id}
            as="li"
            title={SERVICE_NAMES[service.kind]}
            text={
              service.needsLogin
                ? t("settings.linked.needsLogin")
                : `${owner.firstName} ${owner.lastName}`
            }
          >
            <ActionMenu
              label={t("settings.linked.actions")}
              actions={[
                {
                  label: t("settings.linked.unlink"),
                  danger: true,
                  onSelect: () => onUnlink(service, owner),
                },
              ]}
            />
          </SettingRow>
        ))}
      </Card>
    </Section>
  );
}

export function LinkedAccountsSettings({
  account,
  accounts,
}: SettingsSectionProps) {
  const { t } = useTranslation();
  const setCurrent = useAccountStore(state => state.setCurrentAccount);
  const reload = useSyncStore(state => state.reload);
  const [adding, setAdding] = useState<AddAccountStart | null>(null);
  const [removing, setRemoving] = useState<AccountSummary | null>(null);
  const [unlinking, setUnlinking] = useState<{
    service: AccountService;
    owner: AccountSummary;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  /** Clé i18n du dernier échec ou avertissement. */
  const [message, setMessage] = useState<string | null>(null);

  const run = async (task: () => Promise<string | null>) => {
    setBusy(true);
    try {
      setMessage(await task());
    } catch (failure) {
      // Un code du trousseau ou de la base, jamais un secret.
      report("settings", failure);
      setMessage("settings.linked.failed");
    } finally {
      setBusy(false);
      setRemoving(null);
      setUnlinking(null);
    }
  };

  return (
    <>
      <Section title={t("settings.linked.school")}>
        <Card as="ul" rows>
          {accounts.map(candidate => {
            const school = candidate.services.filter(
              service => SERVICE_GROUPS[service.kind] === "school"
            );
            const needsLogin = school.some(service => service.needsLogin);
            // Seul PRONOTE sait se reconnecter pour l'instant.
            const refused = school.find(
              service => service.needsLogin && service.kind === "pronote"
            );
            const relink: AddAccountStart | null = refused?.instanceUrl
              ? {
                  accountId: candidate.id,
                  serviceId: refused.id,
                  url: refused.instanceUrl,
                  name: candidate.schoolName ?? SERVICE_NAMES.pronote,
                }
              : null;
            return (
              <SettingRow
                key={candidate.id}
                as="li"
                media={<Avatar account={candidate} size={44} />}
                title={
                  <>
                    {candidate.firstName} {candidate.lastName}{" "}
                    {candidate.id === account?.id && (
                      <Chip>{t("settings.linked.current")}</Chip>
                    )}
                  </>
                }
                text={
                  [candidate.schoolName, candidate.className]
                    .filter(Boolean)
                    .join(" · ") || t("settings.account.offline")
                }
              >
                {needsLogin && (
                  <span className={styles.warning}>
                    <AlertTriangle size={14} aria-hidden="true" />
                    {t("settings.linked.needsLogin")}
                  </span>
                )}
                <span className={styles.hint}>
                  {[
                    ...new Set(school.map(({ kind }) => SERVICE_NAMES[kind])),
                  ].join(", ")}
                </span>
                <ActionMenu
                  label={t("settings.linked.actions")}
                  actions={[
                    ...(relink
                      ? [
                          {
                            label: t("settings.linked.relink"),
                            onSelect: () => setAdding(relink),
                          },
                        ]
                      : []),
                    ...(candidate.id === account?.id
                      ? []
                      : [
                          {
                            label: t("settings.linked.show"),
                            onSelect: () => setCurrent(candidate.id),
                          },
                        ]),
                    {
                      label: t("settings.linked.remove"),
                      danger: true,
                      onSelect: () => {
                        setMessage(null);
                        setRemoving(candidate);
                      },
                    },
                  ]}
                />
              </SettingRow>
            );
          })}
        </Card>
      </Section>

      <ServiceList
        accounts={accounts}
        group="canteen"
        onUnlink={(service, owner) => {
          setMessage(null);
          setUnlinking({ service, owner });
        }}
      />
      <ServiceList
        accounts={accounts}
        group="calendar"
        onUnlink={(service, owner) => {
          setMessage(null);
          setUnlinking({ service, owner });
        }}
      />

      {message && (
        <p className={styles.error} role="alert">
          {t(message)}
        </p>
      )}

      <div className={styles.actions}>
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => setAdding("service")}
        >
          {t("settings.linked.addAccount")}
        </Button>
        <Button icon={User} onClick={() => setAdding("offline")}>
          {t("settings.linked.addOffline")}
        </Button>
      </div>

      <AddAccountDialog start={adding} onClose={() => setAdding(null)} />
      <ConfirmDialog
        open={removing !== null}
        title={t("settings.linked.removeTitle", {
          name: `${removing?.firstName ?? ""} ${removing?.lastName ?? ""}`,
        })}
        text={t("settings.linked.removeText")}
        confirm={t("settings.linked.remove")}
        danger
        busy={busy}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const target = removing;
          if (target) {
            void run(async () =>
              (await removeAccount(target.id))
                ? null
                : "settings.linked.secretsLeft"
            );
          }
        }}
      />
      <ConfirmDialog
        open={unlinking !== null}
        title={t("settings.linked.unlinkTitle", {
          service: unlinking ? SERVICE_NAMES[unlinking.service.kind] : "",
        })}
        text={t("settings.linked.unlinkText", {
          name: unlinking?.owner.firstName ?? "",
        })}
        confirm={t("settings.linked.unlink")}
        danger
        busy={busy}
        onCancel={() => setUnlinking(null)}
        onConfirm={() => {
          const target = unlinking;
          if (target) {
            void run(async () => {
              await accountManager.unlinkService(target.service.id);
              reload();
              return null;
            });
          }
        }}
      />
    </>
  );
}
