import { platformName } from "@/lib/platform";

import styles from "./ProgressBar.module.scss";

export function ProgressBar({
    progress,
  }: {
    progress: number | null;
  }) {
  return (
    <div className={styles.progressBar}>
      <div
        className={progress === null ? (platformName === "Windows" ? styles.progressWindowsWait : styles.progressLinuxWait) : styles.progress}
        style={{ width: `${progress !== null ? progress : 15}%` }}
      />
    </div>
  );
}
