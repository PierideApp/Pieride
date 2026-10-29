// Variables CSS posées en ligne (`style={{ "--subject": couleur }}`) puis lues par les feuilles
// de style, qui peuvent ainsi les adapter au thème.
import "react";

declare module "react" {
  interface CSSProperties {
    /** Couleur d'une matière (lib/subjects.ts), éclaircie en thème sombre. */
    "--subject"?: string;
    /** Taille d'un avatar, en pixels (components/Avatar). */
    "--avatar-size"?: string;
  }
}
