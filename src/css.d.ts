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
    /** Grille de Cours : nombre d'heures, puis début et fin d'un cours en minutes depuis le haut. */
    "--hours"?: number;
    "--from"?: number;
    "--to"?: number;
    /** Colonne d'un cours parmi ceux qui se chevauchent (modules/cours). */
    "--column"?: number;
    "--columns"?: number;
    /** Part faite d'une barre de progression, entre 0 et 1 (modules/taches). */
    "--progress"?: number;
    /** Point d'une courbe, en pourcentage de sa largeur et de sa hauteur (components/LineChart). */
    "--x"?: number;
    "--y"?: number;
    /** Place d'un widget de l'accueil : colonnes sur 12 (6 en fenêtre étroite) et lignes. */
    "--cols"?: number;
    "--cols-narrow"?: number;
    "--rows"?: number;
    /** Décalage d'un widget glissé à la souris (modules/accueil). */
    "--drag-x"?: string;
    "--drag-y"?: string;
    "--drag-w"?: string;
    "--drag-h"?: string;
    /** Force du voile sombre sur le fond d'écran de l'accueil, entre 0 et 0,7. */
    "--shade"?: number;
    /** Cadre de recadrage, en pourcentage de l'image (components/ImageCropper). */
    "--crop-x"?: number;
    "--crop-y"?: number;
    "--crop-w"?: number;
    "--crop-h"?: number;
  }
}
