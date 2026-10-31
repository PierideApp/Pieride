// Exemples écrits à la main au format de pawnote : aucune vraie donnée d'élève.
import {
  AccountKind,
  type Assignment,
  AssignmentDifficulty,
  AssignmentReturnKind,
  AttachmentKind,
  type Grade,
  GradeKind,
  TabLocation,
  type TimetableClassLesson,
} from "@blockshub/pawnote-lts";
import { describe, expect, it, vi } from "vitest";

import type { Course } from "../shared/models";
import { capabilities, toCourse, toGrade, toHomework } from "./data";
import { PronoteSession } from "./session";

vi.mock("@/lib/http", () => ({}));

const MATHS = { id: "s1", name: "MATHEMATIQUES", inGroups: false };
const START = new Date(2026, 9, 26, 8);
const END = new Date(2026, 9, 26, 9);

function lesson(changes: Partial<TimetableClassLesson> = {}) {
  const base: TimetableClassLesson = {
    is: "lesson",
    id: "c1",
    kind: 0,
    startDate: START,
    endDate: END,
    blockLength: 2,
    blockPosition: 0,
    weekNumber: 9,
    canceled: false,
    exempted: false,
    test: false,
    virtualClassrooms: [],
    personalNames: [],
    teacherNames: ["M. BERNARD"],
    classrooms: ["B12"],
    groupNames: [],
    subject: MATHS,
  };
  return { ...base, ...changes };
}

const points = (value: number) => ({ kind: GradeKind.Grade, points: value });

function grade(changes: Partial<Grade> = {}): Grade {
  return {
    id: "g1",
    value: points(14),
    outOf: points(20),
    date: START,
    subject: MATHS,
    average: points(11.5),
    max: points(18),
    min: points(4),
    coefficient: 2,
    comment: "Contrôle chapitre 3",
    isBonus: false,
    isOptional: false,
    isOutOf20: true,
    ...changes,
  };
}

describe("toCourse", () => {
  it("reprend un cours", () => {
    expect(toCourse(lesson())).toEqual({
      id: `c1@${START.toISOString()}`,
      subject: "MATHEMATIQUES",
      from: START,
      to: END,
      room: "B12",
      teacher: "M. BERNARD",
      group: undefined,
      status: undefined,
    });
  });

  it("joint à la séance son cahier de textes", () => {
    const contents = new Map([
      ["r1", [{ title: "Les suites", category: "Cours", attachments: [] }]],
    ]);
    expect(
      toCourse(lesson({ lessonResourceID: "r1" }), contents).contents
    ).toEqual([{ title: "Les suites", category: "Cours", attachments: [] }]);
    expect(toCourse(lesson(), contents).contents).toBeUndefined();
  });

  it("distingue les séances d'un cours qui revient chaque semaine", () => {
    const nextWeek = new Date(2026, 10, 2, 8);
    expect(toCourse(lesson({ startDate: nextWeek })).id).not.toBe(
      toCourse(lesson()).id
    );
  });

  it.each<[Partial<TimetableClassLesson>, Course["status"]]>([
    [{ canceled: true }, "canceled"],
    [{ status: "Prof. absent" }, "canceled"],
    [{ test: true }, "evaluated"],
    [{ status: "Changement de salle" }, "edited"],
    [{ virtualClassrooms: ["https://visio.exemple.fr"] }, "online"],
  ])("traduit le statut %o", (changes, status) => {
    expect(toCourse(lesson(changes)).status).toBe(status);
  });

  it("nomme une retenue et une activité sans matière", () => {
    expect(
      toCourse({
        is: "detention",
        id: "r1",
        startDate: START,
        endDate: END,
        blockLength: 2,
        blockPosition: 0,
        weekNumber: 9,
        personalNames: [],
        teacherNames: [],
        classrooms: [],
      }).subject
    ).toBe("Retenue");
    expect(
      toCourse({
        is: "activity",
        id: "a1",
        startDate: START,
        endDate: END,
        blockLength: 2,
        blockPosition: 0,
        weekNumber: 9,
        title: "Sortie au musée",
        attendants: [],
        resourceTypeName: "",
        resourceValue: "",
      }).subject
    ).toBe("Sortie au musée");
  });
});

describe("toHomework", () => {
  it("reprend le devoir et ses pièces jointes, sans l'identifiant de session", () => {
    const assignment: Assignment = {
      id: "h1",
      subject: MATHS,
      description: "<p>Exercices 12 à 15</p>",
      backgroundColor: "#ffffff",
      done: true,
      deadline: END,
      attachments: [
        {
          kind: AttachmentKind.Link,
          name: "Cours",
          url: "https://exemple.fr/cours",
          id: "l1",
        },
        {
          kind: AttachmentKind.File,
          name: "sujet.pdf",
          url: "https://exemple.fr/f/sujet.pdf?Session=1234",
          id: "f1",
        },
      ],
      difficulty: AssignmentDifficulty.None,
      themes: [],
      return: { kind: AssignmentReturnKind.None, canUpload: false },
    };
    expect(toHomework(assignment)).toEqual({
      id: "h1",
      subject: "MATHEMATIQUES",
      content: "<p>Exercices 12 à 15</p>",
      dueAt: END,
      done: true,
      attachments: [
        { kind: "link", name: "Cours", url: "https://exemple.fr/cours" },
        {
          kind: "file",
          name: "sujet.pdf",
          url: "https://exemple.fr/f/sujet.pdf",
        },
      ],
    });
  });
});

describe("toGrade", () => {
  it("reprend une note et les résultats de la classe", () => {
    expect(toGrade(grade(), "t1")).toMatchObject({
      id: "g1",
      subject: "MATHEMATIQUES",
      periodId: "t1",
      title: "Contrôle chapitre 3",
      value: 14,
      status: undefined,
      outOf: 20,
      coefficient: 2,
      classAverage: 11.5,
      min: 4,
      max: 18,
    });
  });

  it("garde le statut d'une note sans points, et le 0 d'une absence qui compte", () => {
    const absent = toGrade(
      grade({ value: { kind: GradeKind.Absent, points: 0 } }),
      "t1"
    );
    expect(absent).toMatchObject({ value: undefined, status: "Abs." });
    const zero = toGrade(
      grade({ value: { kind: GradeKind.AbsentZero, points: 0 } }),
      "t1"
    );
    expect(zero).toMatchObject({ value: 0, status: "Abs.*" });
  });

  it("ignore une moyenne vide (NaN) et retombe sur 20 sans barème", () => {
    const result = toGrade(
      grade({
        average: points(Number.NaN),
        outOf: { kind: GradeKind.Error, points: 0 },
      }),
      "t1"
    );
    expect(result.classAverage).toBeUndefined();
    expect(result.outOf).toBe(20);
  });
});

describe("capabilities", () => {
  // Aucune requête : les méthodes ne sont pas appelées.
  const session = new PronoteSession(
    {
      url: "https://0000000a.index-education.net/pronote",
      username: "camille",
      token: "jeton",
      deviceUUID: "appareil",
      kind: AccountKind.STUDENT,
    },
    async () => undefined
  );

  it("ne déclare que les onglets ouverts à l'élève", () => {
    expect(
      Object.keys(
        capabilities(session, [TabLocation.Timetable, TabLocation.Grades])
      )
    ).toEqual(["TIMETABLE", "GRADES"]);
  });
});
