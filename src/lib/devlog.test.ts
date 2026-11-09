import { isTauri } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { devExchange, devRequest, devResult } from "./devlog";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn(() => true) }));

const PRONOTE = new URL(
  "https://0000000a.index-education.net/pronote/appelfonction/3/123456/abcdef"
);
/** Le corps qui part chez PRONOTE : le nom en clair, les données souvent chiffrées. */
const body = (nom: string) =>
  JSON.stringify({
    session: 123456,
    numeroOrdre: "abcdef",
    nom,
    donneesSec: "a1b2c3",
  });

let log: ReturnType<typeof vi.spyOn>;
let group: ReturnType<typeof vi.spyOn>;
/** Tout ce qui est passé à la console, en texte. */
const printed = () => JSON.stringify([...log.mock.calls, ...group.mock.calls]);

beforeEach(() => {
  log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  group = vi
    .spyOn(console, "groupCollapsed")
    .mockImplementation(() => undefined);
  vi.spyOn(console, "groupEnd").mockImplementation(() => undefined);
  vi.mocked(isTauri).mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("devExchange", () => {
  it("montre la fonction, son état, sa durée, puis l'envoyé et le reçu déchiffrés", () => {
    devRequest({
      url: PRONOTE,
      method: "POST",
      content: body("PageActualites"),
      status: 200,
      duration: 121.4,
    });
    expect(log).not.toHaveBeenCalled();
    devExchange({
      name: "PageActualites",
      request: { donnees: { modesAffActus: [0] } },
      response: { donnees: { listeModesAff: [] } },
    });
    expect(group).toHaveBeenCalledWith(
      "[pronote] PageActualites · 200 · 121 ms"
    );
    expect(log).toHaveBeenCalledWith("envoyé", {
      donnees: { modesAffActus: [0] },
    });
    expect(log).toHaveBeenCalledWith("reçu", {
      donnees: { listeModesAff: [] },
    });
  });

  it("lit le nom de la fonction avec les clés de PRONOTE 2025.1.3", () => {
    devRequest({
      url: PRONOTE,
      method: "POST",
      content: JSON.stringify({
        session: 1,
        no: "x",
        id: "DernieresNotes",
        dataSec: "a1",
      }),
      status: 200,
      duration: 5,
    });
    devExchange({ name: "DernieresNotes", request: {}, response: {} });
    expect(group).toHaveBeenCalledWith("[pronote] DernieresNotes · 200 · 5 ms");
  });

  it("montre l'erreur quand pawnote refuse la réponse", () => {
    const error = new Error("La page a expiré");
    devExchange({ name: "DernieresNotes", request: {}, error });
    expect(group).toHaveBeenCalledWith(
      "[pronote] DernieresNotes · réponse refusée"
    );
    expect(log).toHaveBeenCalledWith("erreur", error);
  });

  it.each([
    "Identification",
    "Authentification",
    "SecurisationCompteDoubleAuth",
  ])("ne montre jamais le contenu de %s", name => {
    devExchange({
      name,
      request: { donnees: { identifiant: "camille" } },
      response: { donnees: { jetonConnexionAppliMobile: "secret" } },
    });
    expect(log).toHaveBeenCalledWith(
      `[pronote] ${name} (contenu masqué : connexion)`
    );
    expect(printed()).not.toContain("camille");
    expect(printed()).not.toContain("secret");
  });
});

describe("devRequest", () => {
  it("signale une requête PRONOTE restée sans réponse", () => {
    devRequest({
      url: PRONOTE,
      method: "POST",
      content: body("PageEmploiDuTemps"),
      duration: 60_000,
    });
    expect(log).toHaveBeenCalledWith(
      "[pronote] PageEmploiDuTemps · échec · 60000 ms"
    );
  });

  it("retire la query string des autres requêtes", () => {
    devRequest({
      url: new URL("https://data.geopf.fr/geocodage/search?q=Paris&jeton=abc"),
      method: "GET",
      status: 200,
      duration: 12,
    });
    expect(log).toHaveBeenCalledWith(
      "[http] GET data.geopf.fr/geocodage/search · 200 · 12 ms"
    );
    expect(printed()).not.toContain("jeton");
  });

  it("n'affiche rien hors de Tauri : `pnpm dev` seul, tests", () => {
    vi.mocked(isTauri).mockReturnValue(false);
    devRequest({ url: PRONOTE, method: "POST", duration: 1 });
    devExchange({ name: "DernieresNotes", request: {}, response: {} });
    devResult("pronote", { notes: [] });
    expect(log).not.toHaveBeenCalled();
    expect(group).not.toHaveBeenCalled();
  });
});

describe("devResult", () => {
  it("montre ce que pawnote a tiré, rien pour une requête sans résultat", () => {
    devResult("pronote", { grades: [] });
    devResult("pronote", undefined);
    expect(log).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith("[pronote] ↳ résultat de pawnote", {
      grades: [],
    });
  });
});
