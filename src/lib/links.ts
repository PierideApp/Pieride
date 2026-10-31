// Liens ouverts dans le navigateur de l'ordinateur (plugin opener). Seuls ces domaines sont
// autorisés (capabilities/default.json) : en ajouter un demande d'y ajouter son adresse.
import { openUrl } from "@tauri-apps/plugin-opener";

const REPOSITORY = "https://github.com/PierideApp/Pieride";

export const LINKS = {
  repository: REPOSITORY,
  contributors: `${REPOSITORY}/graphs/contributors`,
  issues: `${REPOSITORY}/issues/new/choose`,
  releases: `${REPOSITORY}/releases`,
  license: `${REPOSITORY}/blob/main/LICENSE`,
  translate: `${REPOSITORY}/tree/main/src/locales`,
  papillon: "https://github.com/PapillonApp/Papillon",
} as const;

export const openLink = (link: keyof typeof LINKS) => openUrl(LINKS[link]);
