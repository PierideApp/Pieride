// Photo de profil d'un compte, ou ses initiales sur un rond de la marque.
import type { Account } from "@/services/shared/models";

import styles from "./Avatar.module.scss";

export const initials = (account: Pick<Account, "firstName" | "lastName">) =>
  `${account.firstName[0] ?? ""}${account.lastName[0] ?? ""}`.toUpperCase();

export function Avatar({
  account,
  size = 36,
}: {
  account: Pick<Account, "firstName" | "lastName" | "avatar">;
  /** En pixels ; le SCSS en déduit la largeur, la hauteur et la taille des initiales. */
  size?: number;
}) {
  const style = { "--avatar-size": `${size}px` };
  return account.avatar ? (
    <img className={styles.avatar} style={style} src={account.avatar} alt="" />
  ) : (
    <span className={styles.avatar} style={style} aria-hidden="true">
      {initials(account)}
    </span>
  );
}
