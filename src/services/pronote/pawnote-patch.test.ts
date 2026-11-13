// Le patch de pawnote (patches/) : une mise à jour de pawnote le fait sauter sans bruit, ces
// tests le signalent. Les réponses imitent celles de PRONOTE, sans données réelles.
import {
  AccountKind,
  createSessionHandle,
  loginToken,
  news,
  newsDetails,
  SessionAccessKind,
  type SessionHandle,
} from "@blockshub/pawnote-lts";
import { describe, expect, it, vi } from "vitest";

/**
 * Une session ouverte sur une instance de cette version, qui ne chiffre ni ne compresse et
 * répond `replies` dans l'ordre. `sent` : le corps de chaque requête.
 */
function openSession(version: number[], ...replies: unknown[]) {
  const sent: unknown[] = [];
  const handle: SessionHandle = createSessionHandle(async ({ content }) => {
    sent.push(JSON.parse(content ?? "null"));
    return {
      status: 200,
      content: JSON.stringify(replies.shift()),
      headers: new Headers(),
    };
  });
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
  return { handle, sent };
}

const RECENT = [2025, 1, 3];
const DONNEES = {
  listeCategories: { V: [] },
  listeModesAff: [{ listeActualites: { V: [] } }],
};

const date = (V: string) => ({ _T: 7, V });
/** Une actualité de la liste au format récent : rubrique dans `nature`, pas de contenu. */
const SUMMARY = {
  N: "65#a",
  L: "Association sportive",
  auteur: "M. Martin",
  dateCreation: date("08/09/2026 08:30:03"),
  dateDebut: date("08/09/2026 07:00:00"),
  dateFin: date("03/07/2027 23:00:00"),
  estInformation: true,
  estSondage: false,
  lue: false,
  reponseAnonyme: false,
  nature: { _T: 24, V: { L: "Divers", N: "70#d" } },
  public: { _T: 24, V: { L: "Élève", N: "46#e", G: 4 } },
  informationListeContenu: { avecPJ: false, aToutRepondu: false },
};
const LIST = {
  dataSec: {
    data: {
      listeModesAff: [{ G: 0, listeActualites: { _T: 24, V: [SUMMARY] } }],
      listeNatures: {
        _T: 24,
        V: [{ L: "Divers", N: "70#d", estDefaut: true }],
      },
    },
  },
};
const DETAILS = {
  dataSec: {
    data: {
      detailsActualite: {
        listeQuestions: {
          _T: 24,
          V: [
            {
              N: "q1",
              L: "",
              titre: "",
              rang: 1,
              genreReponse: 0,
              tailleReponse: 0,
              avecMaximum: false,
              nombreReponsesMax: 0,
              texte: { V: "<p>Inscriptions le mercredi</p>" },
              listePiecesJointes: { V: [] },
              listeChoix: { V: [] },
              reponse: {
                V: { N: "r1", avecReponse: false, estReponseAttendue: true },
              },
            },
          ],
        },
      },
    },
  },
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
      RECENT,
      { id: "PageActualites", dataSec: { data: DONNEES } },
    ],
  ])(
    "passe chaque échange en clair à `onExchange` (%s)",
    async (_, version, reply) => {
      const { handle } = openSession(version, reply);
      handle.onExchange = vi.fn();
      await expect(news(handle)).resolves.toMatchObject({ items: [] });
      expect(handle.onExchange).toHaveBeenCalledWith({
        name: "PageActualites",
        request: expect.any(Object),
        response: Object.values(reply)[1],
      });
    }
  );

  it("lit la liste récente : rubrique dans `nature`, contenu absent", async () => {
    const { handle } = openSession(RECENT, LIST);
    const [item] = (await news(handle)).items;
    expect(item).toMatchObject({
      is: "information",
      title: "Association sportive",
      category: { name: "Divers" },
      content: "",
      attachments: [],
      needToAcknowledge: false,
    });
  });

  it("demande le contenu d'une actualité à part (pronotepy)", async () => {
    const { handle, sent } = openSession(RECENT, LIST, DETAILS);
    const [item] = (await news(handle)).items;
    if (!item) {
      throw new Error("liste vide");
    }
    const full = await newsDetails(handle, item);
    expect(sent[1]).toMatchObject({
      id: "PageActualites",
      dataSec: {
        data: {
          actualite: { N: "65#a", genrePublic: 4, public: { N: "46#e", G: 4 } },
          genreRequeteActualite: 1,
          modeAffActu: 0,
        },
      },
    });
    expect(full).toMatchObject({
      content: "<p>Inscriptions le mercredi</p>",
      needToAcknowledge: true,
      acknowledged: false,
    });
  });
});
