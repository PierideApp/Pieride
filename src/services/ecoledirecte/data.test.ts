import {
  type Client,
  SchoolLifeAttendanceItemType,
} from "@blockshub/blocksdirecte";
import { describe, expect, it, vi } from "vitest";

import {
  downloadEcoledirecteAttachment,
  ecoledirecteCapabilities,
  normalizeMarksResponse,
} from "./data";
import schoolLifeFixture from "./fixtures/school-life.json";
import type { EcoledirecteSession } from "./session";

describe("ÉcoleDirecte Buffer", () => {
  it("reste compatible avec les vérifications instanceof des dépendances", () => {
    const BufferConstructor = globalThis.Buffer;
    if (!BufferConstructor) {
      throw new Error("Le polyfill Buffer n'est pas initialisé");
    }

    const bytes = new Uint8Array([1, 2, 3]);
    expect(() => bytes instanceof BufferConstructor).not.toThrow();
    expect(BufferConstructor.from("QU5HTA==", "base64").toString("utf-8")).toBe(
      "ANGL"
    );
  });
});

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

  it("écarte une note mal formée sans perdre les autres", () => {
    expect(
      normalizeMarksResponse({
        periodes: [],
        notes: [
          { id: 12, date: "07/11/2026", valeur: { note: 12 } },
          { id: 13, date: "08/11/2026", valeur: "15" },
        ],
      }).notes
    ).toEqual([{ id: 13, date: "08/11/2026", valeur: "15" }]);
  });

  it("réutilise le même relevé pour toutes les périodes", async () => {
    const getMark = vi.fn(async () => ({
      periodes: ["A001", "A002"].map(id => ({
        idPeriode: id,
        codePeriode: id,
        periode: id,
        dateDebut: "01/09/2026",
        dateFin: "31/12/2026",
        ensembleMatieres: { disciplines: [] },
      })),
      notes: [],
    }));
    const client = { marks: { getMark } } as unknown as Client;
    const session = {
      selectedAccount: { modules: [{ code: "NOTES" }] },
      run: async <T>(request: (value: Client) => Promise<T>) => request(client),
    } as unknown as EcoledirecteSession;
    const grades = ecoledirecteCapabilities(session).GRADES!;

    const periods = await grades.getGradesPeriods();
    for (const period of periods) {
      await grades.getGradesForPeriod(period);
    }

    expect(getMark).toHaveBeenCalledOnce();
  });
});

describe("ÉcoleDirecte ATTENDANCE", () => {
  it("ne redemande pas le même relevé de vie scolaire pour chaque période", async () => {
    const getSchoolLife = vi.fn(async () => ({ absencesRetards: [] }));
    const client = {
      marks: {
        getMark: async () => ({
          periodes: ["A001", "A002"].map(id => ({
            idPeriode: id,
            codePeriode: id,
            periode: id,
            dateDebut: "01/09/2026",
            dateFin: "31/12/2026",
          })),
          notes: [],
        }),
      },
      schoollife: { getSchoolLife },
    } as unknown as Client;
    const session = {
      selectedAccount: {
        modules: [{ code: "NOTES" }, { code: "VIE_SCOLAIRE" }],
      },
      run: async <T>(request: (value: Client) => Promise<T>) => request(client),
    } as unknown as EcoledirecteSession;
    const attendance = ecoledirecteCapabilities(session).ATTENDANCE!;

    const periods = await attendance.getAttendancePeriods();
    for (const period of periods) {
      await attendance.getAttendanceForPeriod(period);
    }

    expect(getSchoolLife).toHaveBeenCalledOnce();
  });

  it("lit une réponse anonymisée de l'API ÉcoleDirecte", async () => {
    const getSchoolLife = vi.fn(async () => schoolLifeFixture);
    const client = {
      schoollife: { getSchoolLife },
    } as unknown as Client;
    const session = {
      selectedAccount: { modules: [{ code: "VIE_SCOLAIRE" }] },
      run: async <T>(request: (value: Client) => Promise<T>) => request(client),
    } as unknown as EcoledirecteSession;
    const attendance = ecoledirecteCapabilities(session).ATTENDANCE!;
    const period = {
      id: "2026-2027",
      name: "2026-2027",
      start: new Date(2026, 8, 1),
      end: new Date(2027, 7, 31, 23, 59, 59, 999),
    };

    // Extrait anonymisé de la réponse publiée pour /v3/eleves/{id}/viescolaire.awp.
    // https://github.com/EduWireApps/ecoledirecte-api-docs#vie-scolaire
    await expect(
      attendance.getAttendanceForPeriod(period)
    ).resolves.toMatchObject([
      {
        id: "1",
        kind: "absence",
        from: new Date(2026, 10, 20, 8, 30),
        to: new Date(2026, 10, 20, 16, 30),
      },
    ]);
    expect(getSchoolLife).toHaveBeenCalledOnce();
  });

  it("lit les dates détaillées sans notes et écarte les dates invalides", async () => {
    const today = new Date();
    const startYear =
      today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
    const getSchoolLife = vi.fn(async () => ({
      absencesRetards: [
        {
          id: 42,
          typeElement: SchoolLifeAttendanceItemType.ABSENCE,
          displayDate: `Le lundi 9 novembre ${startYear} de 08:00 à 09:00`,
          date: `09/11/${startYear}`,
          motif: "Rendez-vous",
          justifie: true,
        },
        {
          id: 43,
          typeElement: SchoolLifeAttendanceItemType.ABSENCE,
          displayDate: "date invalide",
          date: "date invalide",
          justifie: false,
        },
      ],
    }));
    const client = {
      schoollife: { getSchoolLife },
    } as unknown as Client;
    const session = {
      selectedAccount: { modules: [{ code: "VIE_SCOLAIRE" }] },
      run: async <T>(request: (value: Client) => Promise<T>) => request(client),
    } as unknown as EcoledirecteSession;
    const attendance = ecoledirecteCapabilities(session).ATTENDANCE!;
    const periods = await attendance.getAttendancePeriods();

    expect(periods).toHaveLength(1);
    await expect(
      attendance.getAttendanceForPeriod(periods[0]!)
    ).resolves.toMatchObject([
      {
        id: "42",
        kind: "absence",
        from: new Date(startYear, 10, 9, 8),
        to: new Date(startYear, 10, 9, 9),
      },
    ]);
    expect(getSchoolLife).toHaveBeenCalledOnce();
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

    await expect(news!.getNews(new Map())).resolves.toMatchObject([
      {
        id: "post-42",
        title: "Post-it",
        content: '<p>Affiche</p><img src="data:image/png;base64,iVBORw0KGgo=">',
      },
    ]);
  });
});

describe("ÉcoleDirecte attachments", () => {
  it("mappe les fichiers et liens joints aux devoirs", async () => {
    const file = { id: 42, libelle: "Exercices.pdf", type: "CAHIER_TEXTE" };
    const client = {
      homework: {
        getHomeworksForDate: async (date: string) => ({
          date,
          matieres:
            date === "2026-11-02"
              ? [
                  {
                    matiere: "Mathématiques",
                    aFaire: {
                      idDevoir: 12,
                      contenu: "Questions",
                      donneLe: "30/10/2026",
                      effectue: false,
                      documents: [file],
                      ressourceDocuments: [],
                      liensManuel: [
                        {
                          libelle: "Manuel en ligne",
                          url: "https://example.com/manuel",
                        },
                      ],
                    },
                  },
                ]
              : [],
        }),
      },
    } as unknown as Client;
    const session = {
      selectedAccount: { modules: [{ code: "CAHIER_DE_TEXTES" }] },
      run: async <T>(request: (value: Client) => Promise<T>) => request(client),
    } as unknown as EcoledirecteSession;
    const homework = ecoledirecteCapabilities(session).HOMEWORK;

    await expect(
      homework!.getHomeworks(new Date(2026, 10, 2))
    ).resolves.toMatchObject([
      {
        attachments: [
          {
            kind: "file",
            name: "Exercices.pdf",
            url: "https://api.ecoledirecte.com/v3/telechargement.awp?verbe=get&fichierId=42&leTypeDeFichier=CAHIER_TEXTE",
            ref: JSON.stringify({ id: 42, type: "CAHIER_TEXTE" }),
          },
          {
            kind: "link",
            name: "Manuel en ligne",
            url: "https://example.com/manuel",
          },
        ],
      },
    ]);
  });

  it("charge le contenu d'un cours dont le code semble encodé en Base64", async () => {
    const file = { id: 42, libelle: "Cours.pdf", type: "CAHIER_TEXTE" };
    const codeMatiere = "ANGL";
    const decodedCodeMatiere = new TextDecoder().decode(
      Uint8Array.from(atob(codeMatiere), character => character.charCodeAt(0))
    );
    const getHomeworksForDate = vi.fn(async (date: string) => ({
      date,
      matieres:
        date === "2026-11-02"
          ? [
              {
                codeMatiere: decodedCodeMatiere,
                contenuDeSeance: {
                  contenu: "<p>Lecon du jour</p>",
                  documents: [file],
                  liensManuel: [],
                },
              },
            ]
          : [],
    }));
    const client = {
      timetable: {
        getTimetableBetweenDates: async () => [
          {
            id: 1,
            text: "Mathématiques",
            matiere: "Mathématiques",
            codeMatiere,
            typeCours: "COURS",
            ["start_date"]: "2026-11-02 08:00:00",
            ["end_date"]: "2026-11-02 09:00:00",
            contenuDeSeance: true,
          },
        ],
      },
      homework: {
        getHomeworksForDate,
      },
    } as unknown as Client;
    const session = {
      selectedAccount: {
        modules: [{ code: "EDT" }, { code: "CAHIER_DE_TEXTES" }],
      },
      run: async <T>(request: (value: Client) => Promise<T>) => request(client),
    } as unknown as EcoledirecteSession;
    const capabilities = ecoledirecteCapabilities(session);
    const timetable = capabilities.TIMETABLE;

    await expect(
      timetable!.getWeeklyTimetable(new Date(2026, 10, 2))
    ).resolves.toMatchObject([
      {
        contents: [
          {
            description: "<p>Lecon du jour</p>",
            attachments: [
              {
                kind: "file",
                name: "Cours.pdf",
              },
            ],
          },
        ],
      },
    ]);

    await capabilities.HOMEWORK!.getHomeworks(new Date(2026, 10, 2));
    expect(
      getHomeworksForDate.mock.calls.filter(([date]) => date === "2026-11-02")
    ).toHaveLength(2);
  });

  it("télécharge un fichier avec son identifiant et son type", async () => {
    const bytes = Uint8Array.from([1, 2, 3]);
    const client = {
      downloader: {
        getStream: async (id: number, type: string) => {
          expect(id).toBe(42);
          expect(type).toBe("CAHIER_TEXTE");
          return new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(bytes);
              controller.close();
            },
          });
        },
      },
    } as unknown as Client;
    const session = {
      run: async <T>(request: (value: Client) => Promise<T>) => request(client),
    } as unknown as EcoledirecteSession;

    await expect(
      downloadEcoledirecteAttachment(session, {
        kind: "file",
        name: "Exercices.pdf",
        url: "https://api.ecoledirecte.com/v3/telechargement.awp?fichierId=42&leTypeDeFichier=CAHIER_TEXTE",
        ref: JSON.stringify({ id: 42, type: "CAHIER_TEXTE" }),
      })
    ).resolves.toEqual(bytes);
  });
});
