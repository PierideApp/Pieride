// Personnalisation : thème, couleur d'accentuation et fond d'écran de l'accueil
// (maquette 03-personnalisation). « Changer » ouvre le choix du fond d'écran.
import { Gallery } from "@getpapillon/papicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { ColorSwatches } from "@/components/ColorSwatches/ColorSwatches";
import { Section } from "@/components/Section/Section";
import { SettingRow } from "@/components/SettingRow/SettingRow";
import { ACCENTS, type Theme, useSettingsStore } from "@/stores/settings";
import { useWallpaperStore, wallpaperBackground } from "@/stores/wallpaper";

import styles from "./settings.module.scss";
import { WallpaperSettings } from "./WallpaperSettings";

const THEMES: readonly Theme[] = ["light", "dark", "system"];

/** Mini-fenêtre aux couleurs d'un thème : `data-theme` force ses variables (theme.scss). */
const Preview = ({ theme }: { theme: "light" | "dark" }) => (
  <span className={styles.preview} data-theme={theme}>
    <span className={styles.previewSidebar} />
    <span className={styles.previewLines}>
      <span />
      <span />
      <span />
    </span>
  </span>
);

export function AppearanceSettings() {
  const { t } = useTranslation();
  const theme = useSettingsStore(state => state.theme);
  const accent = useSettingsStore(state => state.accent);
  const setPreference = useSettingsStore(state => state.setPreference);
  const wallpaper = useWallpaperStore();
  const [choosingWallpaper, setChoosingWallpaper] = useState(false);

  if (choosingWallpaper) {
    return <WallpaperSettings onBack={() => setChoosingWallpaper(false)} />;
  }
  const background = wallpaperBackground(wallpaper);

  return (
    <>
      <Section title={t("settings.theme.label")} titleId="appearance-theme">
        <div
          className={styles.themes}
          role="radiogroup"
          aria-labelledby="appearance-theme"
        >
          {THEMES.map(value => (
            <label
              key={value}
              className={styles.theme}
              data-checked={value === theme || undefined}
            >
              <span className={styles.previewFrame} aria-hidden="true">
                {value === "system" ? (
                  <>
                    <Preview theme="light" />
                    <Preview theme="dark" />
                  </>
                ) : (
                  <Preview theme={value} />
                )}
              </span>
              <span className={styles.option}>
                <input
                  type="radio"
                  name="theme"
                  checked={value === theme}
                  onChange={() => setPreference("theme", value)}
                />
                {t(`settings.theme.${value}`)}
              </span>
            </label>
          ))}
        </div>
      </Section>

      <Section title={t("settings.accent.label")} titleId="appearance-accent">
        <Card className={styles.padded}>
          <ColorSwatches
            name="accent"
            labelledBy="appearance-accent"
            value={accent}
            options={ACCENTS.map(({ id, color }) => ({
              value: id,
              color,
              label: t(`settings.accent.${id}`),
            }))}
            onChange={id => setPreference("accent", id)}
          />
          <p className={styles.hint}>{t("settings.accent.text")}</p>
        </Card>
      </Section>

      <Section title={t("settings.wallpaper.label")}>
        <Card>
          <SettingRow
            media={
              <span
                className={styles.wallpaperThumb}
                style={background ? { background } : undefined}
                aria-hidden="true"
              />
            }
            title={t(`settings.wallpaper.${wallpaper.wallpaper ?? "none"}`)}
            text={t("settings.wallpaper.where")}
          >
            <Button icon={Gallery} onClick={() => setChoosingWallpaper(true)}>
              {t("settings.wallpaper.change")}
            </Button>
          </SettingRow>
        </Card>
      </Section>
    </>
  );
}
