// Le patch de pawnote (patches/) : une mise à jour de pawnote le fait sauter sans bruit, ces
// tests le signalent.
import {
  AccountKind,
  createSessionHandle,
  loginToken,
  news,
  SessionAccessKind,
  type SessionHandle,
} from "@blockshub/pawnote-lts";
import { describe, expect, it, vi } from "vitest";

/** Une session ouverte sur une instance de cette version, qui ne chiffre ni ne compresse. */
function openSession(version: number[], reply: unknown): SessionHandle {
  const handle = createSessionHandle(async () => ({
    status: 200,
    content: JSON.stringify(reply),
    headers: new Headers(),
  }));
  handle.information = {
    url: "https://0000000a.index-education.net/pronote",
    id: 1,
    accountKind: AccountKind.STUDENT,
    demo: false,
    accessKind: SessionAccessKind.ACCOUNT,
    rsaModulus: "",
    rsaExponent: "",
    rsaFromConstants: false,
    aesIV: "0123456789abcdef",
    aesKey: "",
    skipEncryption: true,
    skipCompression: true,
    http: false,
    poll: false,
    order: 0,
  };
  const day = new Date(2026, 8, 1);
  handle.instance = {
    nextBusinessDay: day,
    firstMonday: day,
    firstDate: day,
    lastDate: day,
    navigatorIdentifier: "",
    version,
    endings: [],
    periods: [],
    holidays: [],
    weekFrequencies: new Map(),
    blocksPerDay: 0,
  };
  return handle;
}

const DONNEES = {
  listeCategories: { V: [] },
  listeModesAff: [{ listeActualites: { V: [] } }],
};

describe("patch de pawnote", () => {
  it("donne le jeton avant la dernière requête de la connexion (Papillon)", () => {
    expect(String(loginToken)).toContain("onTokenIssued");
  });

  it.each([
    [
      "avant 2025.1.3",
      [2024, 0, 0],
      { nom: "PageActualites", donneesSec: { donnees: DONNEES } },
    ],
    [
      "depuis 2025.1.3",
      [2025, 1, 3],
      { id: "PageActualites", dataSec: { data: DONNEES } },
    ],
  ])(
    "passe chaque échange en clair à `onExchange` (%s)",
    async (_, version, reply) => {
      const handle = openSession(version, reply);
      handle.onExchange = vi.fn();
      await expect(news(handle)).resolves.toMatchObject({ items: [] });
      expect(handle.onExchange).toHaveBeenCalledWith({
        name: "PageActualites",
        request: expect.any(Object),
        response: Object.values(reply)[1],
      });
    }
  );
});
