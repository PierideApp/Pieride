// Fond d'écran de l'accueil (maquette 04-fond-ecran) : un dégradé, ou une image de
// l'ordinateur, glissée ou choisie. Rien n'est téléchargé : la CSP interdit les images
// d'Internet. Le bandeau de l'accueil le lit avec `wallpaperBackground`.
import { Gallery, Trash } from "@getpapillon/papicons";
import { type DragEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import { SubPageHeader } from "@/components/SubPageHeader/SubPageHeader";
import { IMAGE_TYPES, ImageError, resizeImage } from "@/lib/image";
import {
  type Gradient,
  GRADIENTS,
  useWallpaperStore,
  wallpaperBackground,
} from "@/stores/wallpaper";

import styles from "./settings.module.scss";

export function WallpaperSettings({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { wallpaper, image, choose, setImage, clear } = useWallpaperStore();
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  /** Clé i18n du dernier échec. */
  const [error, setError] = useState<string | null>(null);

  const applyFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setImage(await resizeImage(file, 1920, { quality: 0.8 }));
    } catch (failure) {
      setError(
        failure instanceof ImageError
          ? `settings.image.${failure.reason}`
          : "settings.wallpaper.failed"
      );
    } finally {
      setBusy(false);
    }
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void applyFile(event.dataTransfer.files[0]);
  };
  const options: { id: Gradient | "image" | null; background?: string }[] = [
    { id: null },
    ...GRADIENTS.map(({ id }) => ({
      id,
      background: wallpaperBackground({ wallpaper: id, image }),
    })),
    ...(image
      ? [
          {
            id: "image" as const,
            background: wallpaperBackground({ wallpaper: "image", image }),
          },
        ]
      : []),
  ];

  return (
    <>
      <SubPageHeader
        back={t("settings.sections.appearance")}
        onBack={onBack}
        title={t("settings.wallpaper.title")}
        text={t("settings.wallpaper.text")}
        action={
          <Button
            variant="danger"
            icon={Trash}
            disabled={!wallpaper && !image}
            onClick={clear}
          >
            {t("settings.wallpaper.remove")}
          </Button>
        }
      />

      <div
        className={styles.wallpapers}
        role="radiogroup"
        aria-label={t("settings.wallpaper.title")}
      >
        {options.map(({ id, background }) => (
          <label
            key={id ?? "none"}
            className={styles.wallpaper}
            data-checked={id === wallpaper || undefined}
          >
            <span
              className={styles.wallpaperPreview}
              style={background ? { background } : undefined}
            />
            <span className={styles.option}>
              <input
                type="radio"
                name="wallpaper"
                checked={id === wallpaper}
                onChange={() => choose(id)}
              />
              {t(`settings.wallpaper.${id ?? "none"}`)}
            </span>
          </label>
        ))}
      </div>

      <label
        className={styles.dropZone}
        data-dragging={dragging || undefined}
        aria-busy={busy}
        onDragOver={event => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Gallery size={24} aria-hidden="true" />
        {t("settings.wallpaper.drop")}
        <input
          type="file"
          accept={IMAGE_TYPES}
          className={styles.visuallyHidden}
          disabled={busy}
          onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void applyFile(file);
          }}
        />
      </label>
      {error && (
        <p className={styles.error} role="alert">
          {t(error)}
        </p>
      )}
    </>
  );
}
