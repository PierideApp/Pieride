import { Client } from "@blockshub/blocksdirecte";

import { AuthenticationError } from "../shared/errors";
import type { ConnectService } from "../shared/plugin";
import {
  downloadEcoledirecteAttachment,
  ecoledirecteCapabilities,
} from "./data";
import { EcoledirecteSession, parseEcoledirecteSecret } from "./session";

/** Service ÉcoleDirecte branché sur l'AccountManager et ses tables hors ligne. */
export const connectEcoledirecte: ConnectService = async (
  _service,
  secret,
  saveSecret
) => {
  const parsed = parseEcoledirecteSecret(secret);
  if (!parsed) {
    throw new AuthenticationError("Secret ÉcoleDirecte illisible");
  }
  const session = new EcoledirecteSession(new Client(), parsed, saveSecret);
  await session.open();
  return {
    kind: "ecoledirecte",
    capabilities: ecoledirecteCapabilities(session),
    downloadAttachment: attachment =>
      downloadEcoledirecteAttachment(session, attachment),
  };
};
