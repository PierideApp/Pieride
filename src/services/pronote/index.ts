// Service PRONOTE, branché à l'AccountManager dans services/index.ts. La connexion d'un
// nouveau compte est dans `login.ts`, la session et le jeton dans `session.ts`.
import { AuthenticationError } from "../shared/errors";
import type { ConnectService } from "../shared/plugin";
import { capabilities, downloadAttachment } from "./data";
import { loadPhotoSource, profilePhotoDataUrl } from "./login";
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
    getProfilePhoto: async () => {
      const current = (await session.handle()).userResource;
      if (current.profilePictureBase64) {
        return loadPhotoSource(
          profilePhotoDataUrl(current.profilePictureBase64)
        );
      }
      return current.profilePicture?.url
        ? loadPhotoSource(current.profilePicture.url)
        : undefined;
    },
  };
};
