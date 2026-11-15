// Service PRONOTE, branché à l'AccountManager dans services/index.ts. La connexion d'un
// nouveau compte est dans `login.ts`, la session et le jeton dans `session.ts`.
import { resizeImage } from "@/lib/image";

import { AuthenticationError } from "../shared/errors";
import type { ConnectService } from "../shared/plugin";
import { capabilities, downloadAttachment } from "./data";
import { photoOf } from "./login";
import { parseSecret, PronoteSession } from "./session";

export const connectPronote: ConnectService = async (
  _service,
  secret,
  saveSecret,
  auth
) => {
  const parsed = parseSecret(secret);
  if (!parsed) {
    throw new AuthenticationError("Secret PRONOTE illisible");
  }
  const session = new PronoteSession(parsed, saveSecret, auth);
  // Vérifie le jeton tout de suite : un refus marque le service « à reconnecter ».
  const handle = await session.handle();
  return {
    kind: "pronote",
    capabilities: capabilities(session, handle.user.authorizations.tabs),
    downloadAttachment: downloadAttachment(session),
    // Rien seulement si PRONOTE ne donne pas de photo ; un échec (404, image illisible) remonte.
    getProfilePhoto: () =>
      session.run(async ({ userResource }) => {
        const photo = await photoOf(userResource);
        // Réduite sans recadrage, comme un fichier choisi : le cadrage se fait dans les Paramètres.
        return photo ? resizeImage(photo, 2048) : undefined;
      }),
  };
};
