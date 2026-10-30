// Choisir la partie d'une image à garder : un cadre de proportion fixe (`ratio`, largeur sur
// hauteur) qu'on déplace à la souris ou aux flèches, et un zoom qui le resserre. Le reste de
// l'image est assombri. Rend la partie choisie en fractions de l'image (lib/image.ts, `Crop`).
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button/Button";
import type { Crop } from "@/lib/image";

import styles from "./ImageCropper.module.scss";

/** Le cadre le plus petit, en part du plus grand possible. */
const MIN_ZOOM = 0.3;
/** Un appui sur une flèche déplace le cadre de 2 % de l'image. */
const KEY_STEP = 0.02;

const clamp = (value: number, max: number) => Math.max(0, Math.min(value, max));

export function ImageCropper({
  src,
  ratio,
  busy = false,
  onCancel,
  onConfirm,
}: {
  /** L'image, en URL `data:` (la CSP n'en accepte pas d'autre). */
  src: string;
  /** Largeur sur hauteur du cadre (4 pour le bandeau de l'accueil). */
  ratio: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (crop: Crop) => void;
}) {
  const { t } = useTranslation();
  const stage = useRef<HTMLDivElement>(null);
  const start = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  /** Largeur sur hauteur de l'image, connue une fois chargée. */
  const [imageRatio, setImageRatio] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  /** Centre du cadre, en fractions de l'image. */
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 });

  // Le plus grand cadre qui tient dans l'image, réduit par le zoom ; en fractions de l'image.
  const width =
    imageRatio === null ? 1 : Math.min(1, ratio / imageRatio) * zoom;
  const height =
    imageRatio === null ? 1 : Math.min(1, imageRatio / ratio) * zoom;
  const left = clamp(center.x - width / 2, 1 - width);
  const top = clamp(center.y - height / 2, 1 - height);
  const moveTo = (x: number, y: number) =>
    setCenter({ x: x + width / 2, y: y + height / 2 });

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, y: event.clientY, left, top };
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const from = start.current;
    const box = stage.current?.getBoundingClientRect();
    if (!from || !box) {
      return;
    }
    moveTo(
      clamp(from.left + (event.clientX - from.x) / box.width, 1 - width),
      clamp(from.top + (event.clientY - from.y) / box.height, 1 - height)
    );
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const step = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    }[event.key];
    if (step) {
      event.preventDefault();
      moveTo(
        clamp(left + (step[0] ?? 0), 1 - width),
        clamp(top + (step[1] ?? 0), 1 - height)
      );
    }
  };

  return (
    <div className={styles.cropper}>
      <div className={styles.stage} ref={stage}>
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={event =>
            setImageRatio(
              event.currentTarget.naturalWidth /
                event.currentTarget.naturalHeight
            )
          }
        />
        {imageRatio !== null && (
          <div
            className={styles.frame}
            role="group"
            tabIndex={0}
            aria-label={t("imageCropper.frame")}
            style={{
              "--crop-x": left * 100,
              "--crop-y": top * 100,
              "--crop-w": width * 100,
              "--crop-h": height * 100,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => {
              start.current = null;
            }}
            onKeyDown={onKeyDown}
          />
        )}
      </div>
      <label className={styles.zoom}>
        {t("imageCropper.zoom")}
        <input
          type="range"
          min={MIN_ZOOM * 100}
          max={100}
          value={Math.round(zoom * 100)}
          onChange={event => setZoom(Number(event.target.value) / 100)}
        />
      </label>
      <div className={styles.actions}>
        <Button onClick={onCancel}>{t("imageCropper.cancel")}</Button>
        <Button
          variant="primary"
          disabled={busy || imageRatio === null}
          onClick={() => onConfirm({ x: left, y: top, width, height })}
        >
          {t("imageCropper.confirm")}
        </Button>
      </div>
    </div>
  );
}
