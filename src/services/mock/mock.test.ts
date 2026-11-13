import { describe, expect, it } from "vitest";

import { weekStart } from "@/lib/week";

import { mockPlugin } from ".";

// Lundi 26 octobre 2026 : premier trimestre de l'année 2026-2027.
const NOW = new Date(2026, 9, 26, 10);
const { TIMETABLE, HOMEWORK, GRADES, NEWS } = mockPlugin(
  () => NOW
).capabilities;

describe("données fictives", () => {
  it("remplit la semaine demandée, avec des identifiants propres à chaque semaine", async () => {
    const monday = weekStart(NOW);
    const nextMonday = new Date(2026, 10, 2);
    const week = await TIMETABLE?.getWeeklyTimetable(monday);
    const next = await TIMETABLE?.getWeeklyTimetable(nextMonday);
    const homework = await HOMEWORK?.getHomeworks(monday);

    expect(week?.length).toBeGreaterThan(0);
    for (const item of [...(week ?? []), ...(homework ?? [])]) {
      const date = "from" in item ? item.from : item.dueAt;
      expect(date >= monday && date < nextMonday).toBe(true);
    }
    const ids = week?.map(course => course.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
    expect(next?.some(course => ids.includes(course.id))).toBe(false);
  });

  it("ne donne que les notes déjà passées, dans leur trimestre", async () => {
    const periods = (await GRADES?.getGradesPeriods()) ?? [];
    expect(periods.map(period => period.name)).toEqual([
      "Trimestre 1",
      "Trimestre 2",
      "Trimestre 3",
    ]);
    expect(periods[0]?.start).toEqual(new Date(2026, 8, 1));

    const [first, second] = periods;
    const now = first && (await GRADES?.getGradesForPeriod(first))?.grades;
    const later = second && (await GRADES?.getGradesForPeriod(second))?.grades;
    expect(now?.length).toBeGreaterThan(0);
    expect(now?.every(grade => grade.date <= NOW)).toBe(true);
    expect(later).toEqual([]);
  });

  it("couvre chaque cas que PRONOTE peut renvoyer", async () => {
    const week = (await TIMETABLE?.getWeeklyTimetable(weekStart(NOW))) ?? [];
    const homework = (await HOMEWORK?.getHomeworks(weekStart(NOW))) ?? [];
    const news = (await NEWS?.getNews(new Map())) ?? [];
    const kinds = (attachments: { kind: string }[]) =>
      new Set(attachments.map(attachment => attachment.kind));

    expect(new Set(week.map(course => course.status))).toEqual(
      new Set([undefined, "canceled", "edited", "online", "evaluated"])
    );
    expect(week.some(course => course.group)).toBe(true);
    expect(week.some(course => !course.room && !course.teacher)).toBe(true);
    expect(
      kinds(
        week.flatMap(course =>
          (course.contents ?? []).flatMap(content => content.attachments)
        )
      )
    ).toEqual(new Set(["file", "link"]));
    expect(kinds(homework.flatMap(item => item.attachments))).toEqual(
      new Set(["file", "link"])
    );

    expect(news.some(item => item.kind === "survey")).toBe(true);
    expect(news.some(item => item.title === undefined)).toBe(true);
    expect(news.some(item => item.category === undefined)).toBe(true);
    expect(
      new Set(
        news
          .filter(item => item.needsAcknowledgement)
          .map(item => item.acknowledged)
      )
    ).toEqual(new Set([false, true]));
    expect(kinds(news.flatMap(item => item.attachments))).toEqual(
      new Set(["file", "link"])
    );
  });

  it("garde lue ou accusée une actualité pour la session", async () => {
    const pending = (await NEWS?.getNews(new Map()))?.find(
      item => item.needsAcknowledgement && !item.acknowledged
    );
    await NEWS?.setNewsAsAcknowledged(pending?.id ?? "");
    const again = (await NEWS?.getNews(new Map()))?.find(
      item => item.id === pending?.id
    );
    expect(again).toMatchObject({ read: true, acknowledged: true });
  });

  it("donne un vrai PDF pour une pièce jointe fictive", async () => {
    const bytes = await mockPlugin().downloadAttachment?.({
      kind: "file",
      name: "Fiche suites.pdf",
      url: "mock:Fiche suites.pdf",
    });
    const pdf = String.fromCharCode(...(bytes ?? []));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("(Document fictif : Fiche suites.pdf)");
    // Chaque entrée de la table `xref` pointe sur le début de son objet.
    const table = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    const offsets = [...pdf.slice(table).matchAll(/(\d{10}) 00000 n/g)].map(
      ([, offset]) => Number(offset)
    );
    expect(offsets).toHaveLength(5);
    offsets.forEach((offset, index) =>
      expect(pdf.startsWith(`${index + 1} 0 obj`, offset)).toBe(true)
    );
  });

  it("garde un devoir coché pour la session", async () => {
    const [first] = (await HOMEWORK?.getHomeworks(weekStart(NOW))) ?? [];
    await HOMEWORK?.setHomeworkCompletion(first?.id ?? "", !first?.done);
    const [again] = (await HOMEWORK?.getHomeworks(weekStart(NOW))) ?? [];
    expect(again?.done).toBe(!first?.done);
  });
});
