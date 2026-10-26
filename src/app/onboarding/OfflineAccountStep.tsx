// Compte hors ligne : un prénom suffit. Le compte est créé dans la base, sans service ni secret.
import { Calendar, Link, Palette, Tasks } from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { accountManager } from "@/services";
import { useAccountStore } from "@/stores/accounts";
import { useSyncStore } from "@/stores/sync";

import styles from "./onboarding.module.scss";

const FEATURES = [
  { id: "events", icon: Calendar },
  { id: "homework", icon: Tasks },
  { id: "personalize", icon: Palette },
  { id: "link", icon: Link },
] as const;

export function OfflineAccountStep({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation();
  const setCurrentAccount = useAccountStore(state => state.setCurrentAccount);
  const reload = useSyncStore(state => state.reload);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const create = async () => {
    setSaving(true);
    const id = crypto.randomUUID();
    try {
      await accountManager.addAccount({
        id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
    } catch (error) {
      // Seul un code d'erreur de la base remonte ici, utile pour un signalement.
      // eslint-disable-next-line no-console
      console.error(error);
      setFailed(true);
      setSaving(false);
      return;
    }
    // L'app relit les comptes et quitte le premier lancement.
    setCurrentAccount(id);
    reload();
  };

  return (
    <form
      className={styles.step}
      onSubmit={event => {
        event.preventDefault();
        void create();
      }}
    >
      <p className={styles.eyebrow}>{t("onboarding.offline.eyebrow")}</p>
      <h1 className={styles.title}>{t("onboarding.offline.title")}</h1>
      <p className={styles.text}>{t("onboarding.offline.text")}</p>

      <div className={styles.fields}>
        <label className={styles.field}>
          {t("onboarding.offline.firstName")}
          <input
            required
            maxLength={50}
            autoComplete="given-name"
            placeholder={t("onboarding.offline.firstNamePlaceholder")}
            value={firstName}
            onChange={event => setFirstName(event.target.value)}
            // L'étape ne sert qu'à ça.
            autoFocus
          />
        </label>
        <label className={styles.field}>
          {t("onboarding.offline.lastName")}
          <input
            maxLength={50}
            autoComplete="family-name"
            placeholder={t("onboarding.offline.lastNamePlaceholder")}
            value={lastName}
            onChange={event => setLastName(event.target.value)}
          />
        </label>
      </div>

      <ul className={styles.features}>
        {FEATURES.map(feature => (
          <li key={feature.id}>
            <feature.icon size={18} className={styles.featureIcon} />
            {t(`onboarding.offline.features.${feature.id}`)}
          </li>
        ))}
      </ul>

      {failed && (
        <p className={styles.error} role="alert">
          {t("errors.database")}
        </p>
      )}

      <footer className={styles.footer}>
        <button type="button" className={styles.secondary} onClick={onCancel}>
          {t("onboarding.offline.cancel")}
        </button>
        <button
          type="submit"
          className={styles.primary}
          disabled={saving || firstName.trim() === ""}
        >
          {t("onboarding.offline.create")}
        </button>
      </footer>
    </form>
  );
}
