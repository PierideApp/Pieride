// Panneau détail (UX §3 et §4) : à côté du contenu à partir de 1280 px, par-dessus entre
// 960 et 1279 px, à sa place en dessous (layout.module.scss). `Échap` le ferme.
import { Cross } from "@getpapillon/papicons";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useDetailStore } from "@/stores/detail";

import styles from "./layout.module.scss";

export function DetailPanel() {
  const { t } = useTranslation();
  const { content, close } = useDetailStore();

  useEffect(() => {
    if (!content) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      // `Échap` dans la palette ne ferme qu'elle.
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [content, close]);

  if (!content) {
    return null;
  }
  return (
    <aside className={styles.detail} aria-label={content.title}>
      <header className={styles.detailBar} data-tauri-drag-region>
        <button
          type="button"
          className={styles.detailClose}
          aria-label={t("detail.close")}
          onClick={close}
        >
          <Cross size={18} />
        </button>
        <span className={styles.detailHint}>{t("detail.hint")}</span>
      </header>
      <h2 className={styles.detailTitle}>{content.title}</h2>
      {content.subtitle && (
        <p className={styles.detailSubtitle}>{content.subtitle}</p>
      )}
      <div className={styles.detailBody}>{content.body}</div>
    </aside>
  );
}
