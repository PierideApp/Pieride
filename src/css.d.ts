// Variables CSS posées en ligne (`style={{ "--subject": couleur }}`) puis lues par les feuilles
// de style, qui peuvent ainsi les adapter au thème.
import "react";

declare module "react" {
  interface CSSProperties {
    /** Couleur d'une matière, puis sa version éclaircie pour le thème sombre (lib/subjects.ts). */
    "--subject"?: string;
    "--subject-dark"?: string;
    /** Taille d'un avatar, en pixels (components/Avatar). */
    "--avatar-size"?: string;
  }
}
