import type { Client } from "@blockshub/blocksdirecte";
import { describe, expect, it } from "vitest";

import { ecoledirecteCapabilities, normalizeMarksResponse } from "./data";
import type { EcoledirecteSession } from "./session";

describe("ÉcoleDirecte GRADES", () => {
  it("synchronise les périodes et moyennes quand la réponse omet notes", async () => {
    const report = {
      moyenneGenerale: "14,5",
      moyenneClasse: "12,5",
      disciplines: [],
    };
    const markData = {
      periodes: [
        {
          idPeriode: "A001",
          codePeriode: "A001",
          periode: "1er trimestre",
          dateDebut: "01/09/2026",
          dateFin: "31/12/2026",
          ensembleMatieres: report,
        },
      ],
      notes: undefined,
    };
    const client = {
      marks: { getMark: async () => markData },
    } as unknown as Client;
    const session = {
      selectedAccount: { modules: [{ code: "NOTES" }] },
      run: async <T>(request: (value: Client) => Promise<T>) => request(client),
    } as unknown as EcoledirecteSession;
    const grades = ecoledirecteCapabilities(session).GRADES;

    expect(grades).toBeDefined();
    const periods = await grades!.getGradesPeriods();
    expect(periods).toHaveLength(1);
    await expect(
      grades!.getGradesForPeriod(periods[0]!)
    ).resolves.toMatchObject({
      grades: [],
      averages: [],
      overall: { student: 14.5, classAverage: 12.5 },
    });
  });

  it("mappe une note et ses moyennes depuis une réponse de service", async () => {
    const markData = {
      periodes: [
        {
          idPeriode: "A001",
          codePeriode: "A001",
          periode: "1er trimestre",
          dateDebut: "01/09/2026",
          dateFin: "31/12/2026",
          ensembleMatieres: {
            moyenneGenerale: "14,5",
            moyenneClasse: "12,5",
            disciplines: [
              {
                discipline: "Mathématiques",
                codeMatiere: "MAT",
                moyenne: "15",
                moyenneClasse: "13",
                moyenneMin: "8",
                moyenneMax: "19",
              },
            ],
          },
        },
      ],
      notes: [
        {
          id: 42,
          date: "07/11/2026",
          codePeriode: "A001",
          devoir: "Contrôle",
          commentaire: "",
          libelleMatiere: "Mathématiques",
          codeMatiere: "MAT",
          valeur: "15,5",
          noteSur: "20",
          coef: "2",
          moyenneClasse: "13,5",
          minClasse: "6",
          maxClasse: "19",
          nonSignificatif: false,
        },
      ],
    };
    const client = {
      marks: { getMark: async () => markData },
    } as unknown as Client;
    const session = {
      selectedAccount: { modules: [{ code: "NOTES" }] },
      run: async <T>(request: (value: Client) => Promise<T>) => request(client),
    } as unknown as EcoledirecteSession;
    const grades = ecoledirecteCapabilities(session).GRADES;
    const periods = await grades!.getGradesPeriods();

    await expect(
      grades!.getGradesForPeriod(periods[0]!)
    ).resolves.toMatchObject({
      grades: [
        {
          id: "A001-42",
          subject: "Mathématiques",
          title: "Contrôle",
          value: 15.5,
          outOf: 20,
          coefficient: 2,
          classAverage: 13.5,
          min: 6,
          max: 19,
        },
      ],
      averages: [
        {
          subject: "Mathématiques",
          student: 15,
          classAverage: 13,
          min: 8,
          max: 19,
        },
      ],
      overall: { student: 14.5, classAverage: 12.5 },
    });
  });

  it("refuse une réponse sans périodes plutôt que de la prendre pour des notes vides", async () => {
    const client = {
      marks: { getMark: async () => ({ notes: undefined }) },
    } as unknown as Client;
    const session = {
      selectedAccount: { modules: [{ code: "NOTES" }] },
      run: async <T>(request: (value: Client) => Promise<T>) => request(client),
    } as unknown as EcoledirecteSession;
    const grades = ecoledirecteCapabilities(session).GRADES;

    await expect(grades!.getGradesPeriods()).rejects.toThrow(
      "Réponse des notes ÉcoleDirecte incomplète"
    );
  });

  it("refuse les entrées de notes mal formées avant leur mapping", () => {
    expect(() =>
      normalizeMarksResponse({
        periodes: [],
        notes: [{ id: 12, date: "07/11/2026", valeur: { note: 12 } }],
      })
    ).toThrow("Liste des notes ÉcoleDirecte invalide");
  });
});

describe("ÉcoleDirecte NEWS", () => {
  it("intègre les images protégées du fil public avec le téléchargement authentifié", async () => {
    const pngHeader = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const client = {
      timeline: {
        getPublicTimeline: async () => ({
          evenements: [],
          postits: [
            {
              id: 42,
              auteur: { prenom: "Camille", nom: "Martin" },
              dateCreation: "07/11/2026",
              dateDebut: "07/11/2026",
              contenu:
                '<p>Affiche</p><img src="https://api.ecoledirecte.com/v3/telechargement.awp?verbe=get&amp;fichierId=7&amp;leTypeDeFichier=POSTIT">',
              type: "info",
            },
          ],
        }),
      },
      downloader: {
        getStream: async (fileId: number, fileType: string) => {
          expect(fileId).toBe(7);
          expect(fileType).toBe("POSTIT");
          return new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(pngHeader);
              controller.close();
            },
          });
        },
      },
    } as unknown as Client;
    const session = {
      selectedAccount: { modules: [] },
      run: async <T>(request: (value: Client) => Promise<T>) => request(client),
    } as unknown as EcoledirecteSession;
    const news = ecoledirecteCapabilities(session).NEWS;

    await expect(news!.getNews()).resolves.toMatchObject([
      {
        id: "post-42",
        content: '<p>Affiche</p><img src="data:image/png;base64,iVBORw0KGgo=">',
      },
    ]);
  });
});
