// Choisis ton établissement (maquette 06-recherche-etablissement) : une ville, puis les
// établissements PRONOTE autour, du plus proche au plus loin. Une grande ville en compte des
// centaines : un second champ les filtre par nom ou code postal, comme dans Papillon.
import { GraduationHat } from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { SearchField } from "@/components/SearchField/SearchField";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { Spinner } from "@/components/Spinner/Spinner";
import { useLookup } from "@/hooks/useLookup";
import { matches } from "@/lib/search";
import { findSchools, type School } from "@/services/pronote/login";

import styles from "../onboarding.module.scss";
import { logFailure } from "./errors";
import pronote from "./pronote.module.scss";

/** L'écran n'affiche qu'un message général : le détail d'un échec va au journal. */
const searchSchools = (query: string) =>
  findSchools(query).catch((error: unknown) => {
    logFailure("recherche", error);
    throw error;
  });

export function CityStep({ onNext }: { onNext: (school: School) => void }) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const text = query.trim();
  const search = useLookup(text.length >= 2 ? text : "", searchSchools);
  const found = search.status === "ready" ? search.data : null;
  const schools = found?.schools ?? [];
  const postalCode = (school: School) =>
    String(school.postalCode).padStart(5, "0");
  const shown = schools.filter(school =>
    matches(`${school.name} ${postalCode(school)}`, filter)
  );
  const chosen = shown.find(school => school.url === selected);
  const distance = new Intl.NumberFormat(i18n.language, {
    style: "unit",
    unit: "kilometer",
    maximumFractionDigits: 1,
  });

  return (
    <div className={`${styles.step} ${pronote.cityStep}`}>
      <p className={styles.eyebrow}>{t("onboarding.pronote.searchEyebrow")}</p>
      <h1 className={styles.title}>{t("onboarding.pronote.searchTitle")}</h1>
      <p className={styles.text}>{t("onboarding.pronote.searchText")}</p>

      <SearchField
        size="large"
        value={query}
        onChange={setQuery}
        placeholder={t("onboarding.pronote.searchPlaceholder")}
      />

      {search.status === "loading" && (
        <p className={pronote.status}>
          <Spinner />
          {t("onboarding.pronote.searching")}
        </p>
      )}
      {search.status === "error" && (
        <p className={styles.error} role="alert">
          {t("onboarding.pronote.searchFailed")}
        </p>
      )}
      {search.status === "ready" && !found && (
        <p className={pronote.status}>{t("onboarding.pronote.noCity")}</p>
      )}
      {found && schools.length === 0 && (
        <p className={pronote.status}>
          {t("onboarding.pronote.noSchool", { city: found.city })}
        </p>
      )}
      {found && schools.length > 0 && (
        <>
          <p className={pronote.listHead}>
            <span>
              {t("onboarding.pronote.schoolsIn", { city: found.city })}
            </span>
            <span>
              {t("onboarding.pronote.results", { count: shown.length })}
            </span>
          </p>
          <div className={pronote.filter}>
            <SearchField
              value={filter}
              onChange={setFilter}
              placeholder={t("onboarding.pronote.filterPlaceholder")}
            />
          </div>
          {shown.length === 0 && (
            <p className={pronote.status}>
              {t("onboarding.pronote.noFilterMatch")}
            </p>
          )}
          <Card
            rows
            className={pronote.schools}
            role="radiogroup"
            aria-label={t("onboarding.pronote.searchTitle")}
            hidden={shown.length === 0}
          >
            {shown.map(school => (
              <SettingRow
                key={school.url}
                as="label"
                icon={GraduationHat}
                title={school.name}
                text={postalCode(school)}
                value={distance.format(school.distance / 1000)}
              >
                <input
                  type="radio"
                  name="school"
                  checked={school === chosen}
                  onChange={() => setSelected(school.url)}
                />
              </SettingRow>
            ))}
          </Card>
        </>
      )}

      <footer className={styles.footer}>
        <Button
          variant="primary"
          size="large"
          disabled={!chosen}
          onClick={() => chosen && onNext(chosen)}
        >
          {t("onboarding.continue")}
        </Button>
      </footer>
    </div>
  );
}
