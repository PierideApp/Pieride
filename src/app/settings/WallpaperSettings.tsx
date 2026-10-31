// Fond d'écran de l'accueil (maquette 04-fond-ecran) : un dégradé, ou une image de
// l'ordinateur, glissée ou choisie, dont on garde la partie voulue (cadre à la proportion du
// bandeau de l'accueil). Rien n'est téléchargé : la CSP interdit les images d'Internet. Le
// bandeau de l'accueil le lit avec `wallpaperBackground`.
import { Gallery, Trash } from "@getpapillon/papicons";
import { type DragEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import { ImageCropper } from "@/components/ImageCropper/ImageCropper";
import { SubPageHeader } from "@/components/SubPageHeader/SubPageHeader";
import { shadeFor } from "@/lib/color";
import {
  type Crop,
  cropImage,
  IMAGE_TYPES,
  ImageError,
  resizeImage,
  topBrightness,
} from "@/lib/image";
import {
  type Gradient,
  GRADIENTS,
  useWallpaperStore,
  WALLPAPER_RATIO,
  wallpaperBackground,
} from "@/stores/wallpaper";

/** Largeur de l'image gardée : nette sur un grand écran, légère dans le stockage local. */
const WALLPAPER_WIDTH = 2400;

import styles from "./settings.module.scss";

export function WallpaperSettings({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { wallpaper, image, choose, setImage, clear } = useWallpaperStore();
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  /** Clé i18n du dernier échec. */
  const [error, setError] = useState<string | null>(null);
  /** L'image choisie, en attente de son cadrage (URL `data:`). */
  const [cropping, setCropping] = useState<string | null>(null);

  const fail = (failure: unknown) =>
    setError(
      failure instanceof ImageError
        ? `settings.image.${failure.reason}`
        : "settings.wallpaper.failed"
    );

  const applyFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setCropping(
        await resizeImage(file, WALLPAPER_WIDTH * 2, { quality: 0.85 })
      );
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  };
  const keep = async (source: string, crop: Crop) => {
    setBusy(true);
    setError(null);
    try {
      const image = await cropImage(source, crop, WALLPAPER_WIDTH);
      // Le voile qui garde le texte blanc du bandeau lisible sur cette image.
      setImage(image, shadeFor(await topBrightness(image)));
      setCropping(null);
    } catch (failure) {
      fail(failure);
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

      {cropping ? (
        <section className={styles.crop} aria-labelledby="wallpaper-crop">
          <h3 id="wallpaper-crop">{t("settings.wallpaper.cropTitle")}</h3>
          <p>{t("settings.wallpaper.cropText")}</p>
          <ImageCropper
            src={cropping}
            ratio={WALLPAPER_RATIO}
            busy={busy}
            onCancel={() => setCropping(null)}
            onConfirm={crop => void keep(cropping, crop)}
          />
        </section>
      ) : (
        <>
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
        </>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {t(error)}
        </p>
      )}
    </>
  );
}
