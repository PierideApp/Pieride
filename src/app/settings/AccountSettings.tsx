// Mon compte (maquette 01-mon-compte) : le profil tel qu'il apparaît dans Piéride. Prénom,
// nom et photo se modifient ici ; établissement et classe viennent des services.
// « Récupérer depuis ton ENT » arrivera avec la connexion PRONOTE.
import {
  Camera,
  Folder,
  GraduationHat,
  Trash,
  User,
} from "@getpapillon/papicons";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Avatar } from "@/components/Avatar/Avatar";
import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { Chip } from "@/components/Chip/Chip";
import { Notice } from "@/components/Notice/Notice";
import { Section } from "@/components/Section/Section";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { TextField } from "@/components/TextField/TextField";
import { IMAGE_TYPES, ImageError, resizeImage } from "@/lib/image";
import { report } from "@/lib/log";
import { accountManager } from "@/services";
import { SERVICE_GROUPS, SERVICE_NAMES } from "@/services/shared/plugin";
import { useSyncStore } from "@/stores/sync";

import type { SettingsSectionProps } from "./Settings";
import styles from "./settings.module.scss";

/** Champ enregistré quand on le quitte (ou avec Entrée), s'il a changé et n'est pas vide. */
function NameField({
  label,
  value,
  required,
  autoComplete,
  onSave,
}: {
  label: string;
  value: string;
  required: boolean;
  autoComplete: string;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <TextField
      label={label}
      value={draft}
      maxLength={50}
      required={required}
      autoComplete={autoComplete}
      onChange={event => setDraft(event.target.value)}
      onBlur={() => {
        const next = draft.trim();
        if (next === value || (required && next === "")) {
          setDraft(value);
        } else {
          onSave(next);
        }
      }}
      onKeyDown={event => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export function AccountSettings({ account }: SettingsSectionProps) {
  const { t } = useTranslation();
  const reload = useSyncStore(state => state.reload);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  /** Clé i18n du dernier échec. */
  const [error, setError] = useState<string | null>(null);

  if (!account) {
    return <Notice>{t("settings.account.noAccount")}</Notice>;
  }
  const schoolServices = [
    ...new Set(
      account.kinds
        .filter(kind => SERVICE_GROUPS[kind] === "school")
        .map(kind => SERVICE_NAMES[kind])
    ),
  ];
  const choose = () => fileInput.current?.click();

  const save = async (
    profile: Parameters<typeof accountManager.updateAccount>[1]
  ) => {
    setError(null);
    try {
      await accountManager.updateAccount(account.id, profile);
      reload("accounts");
    } catch (failure) {
      // Seul un code d'erreur de la base remonte ici.
      report("settings", failure);
      setError("errors.database");
    }
  };
  const choosePhoto = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      await save({ avatar: await resizeImage(file, 256, { square: true }) });
    } catch (failure) {
      setError(
        failure instanceof ImageError
          ? `settings.image.${failure.reason}`
          : "errors.database"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card
        as="section"
        className={styles.profile}
        aria-label={t("settings.account.profile")}
      >
        <button
          type="button"
          className={styles.profilePhoto}
          aria-label={t("settings.account.changePhoto")}
          disabled={busy}
          onClick={choose}
        >
          <Avatar account={account} size={96} />
          <span className={styles.profileCamera} aria-hidden="true">
            <Camera size={16} />
          </span>
        </button>
        <div className={styles.profileText}>
          <h3>
            {account.firstName} {account.lastName}
          </h3>
          <p>
            {[account.className, account.schoolName]
              .filter(Boolean)
              .join(" · ") || t("settings.account.offline")}
          </p>
          <div className={styles.chips}>
            {schoolServices.map(name => (
              <Chip key={name} tone="accent">
                {name}
              </Chip>
            ))}
          </div>
        </div>
        <Button icon={Camera} disabled={busy} onClick={choose}>
          {t("settings.account.changePhoto")}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept={IMAGE_TYPES}
          hidden
          onChange={event => {
            const file = event.target.files?.[0];
            // Pour pouvoir choisir à nouveau le même fichier.
            event.target.value = "";
            if (file) {
              void choosePhoto(file);
            }
          }}
        />
      </Card>
      {error && (
        <p className={styles.error} role="alert">
          {t(error)}
        </p>
      )}

      <Section title={t("settings.account.identity")}>
        <Card className={styles.fields}>
          <NameField
            key={`${account.id}-first`}
            label={t("settings.account.firstName")}
            value={account.firstName}
            required
            autoComplete="given-name"
            onSave={firstName => void save({ firstName })}
          />
          <NameField
            key={`${account.id}-last`}
            label={t("settings.account.lastName")}
            value={account.lastName}
            required={false}
            autoComplete="family-name"
            onSave={lastName => void save({ lastName })}
          />
        </Card>
      </Section>

      <Section title={t("settings.account.photo")}>
        <Card rows>
          <SettingRow
            as="button"
            icon={Folder}
            title={t("settings.account.fromFile")}
            text={t("settings.account.fromFileText")}
            disabled={busy}
            onClick={choose}
          />
          {account.avatar && (
            <SettingRow
              as="button"
              icon={Trash}
              tone="danger"
              title={t("settings.account.removePhoto")}
              disabled={busy}
              onClick={() => void save({ avatar: null })}
            />
          )}
        </Card>
      </Section>

      {(account.schoolName || account.className) && (
        <Section
          title={t("settings.account.fromServices", {
            services: schoolServices.join(", "),
          })}
        >
          <Card rows>
            {account.schoolName && (
              <SettingRow
                icon={GraduationHat}
                title={t("settings.account.school")}
                value={account.schoolName}
              />
            )}
            {account.className && (
              <SettingRow
                icon={User}
                title={t("settings.account.className")}
                value={account.className}
              />
            )}
          </Card>
        </Section>
      )}
    </>
  );
}
