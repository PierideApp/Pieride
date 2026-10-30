import { describe, expect, it, vi } from "vitest";

import { isStale, Source } from "./useQuery";

const flush = () => new Promise(resolve => setTimeout(resolve));

describe("Source", () => {
  it("partage une lecture en cours et garde son résultat", async () => {
    const source = new Source<number>("grades");
    const load = vi.fn(() => Promise.resolve(1));
    source.refresh("a", "0", load);
    source.refresh("a", "0", load);
    await flush();
    source.refresh("a", "0", load);
    expect(load).toHaveBeenCalledTimes(1);
    expect(source.get("a")).toEqual({ status: "ready", data: 1 });
  });

  it("relit quand les sujets changent, en gardant l'ancien résultat en attendant", async () => {
    const source = new Source<number>("grades");
    source.refresh("a", "0", () => Promise.resolve(1));
    await flush();
    source.refresh("a", "1", () => Promise.resolve(2));
    expect(source.get("a")).toEqual({ status: "ready", data: 1 });
    await flush();
    expect(source.get("a")).toEqual({ status: "ready", data: 2 });
  });

  it("ignore une lecture dépassée par une plus récente", async () => {
    const source = new Source<number>("grades");
    const slow = new Promise<number>(resolve => setTimeout(resolve, 10, 1));
    source.refresh("a", "0", () => slow);
    source.refresh("a", "1", () => Promise.resolve(2));
    await slow;
    await flush();
    expect(source.get("a")).toEqual({ status: "ready", data: 2 });
  });

  it("retente une lecture en échec", async () => {
    const source = new Source<number>("grades");
    source.refresh("a", "0", () => Promise.reject(new Error("base")));
    await flush();
    expect(source.get("a")).toEqual({ status: "error" });
    source.refresh("a", "0", () => Promise.resolve(1));
    await flush();
    expect(source.get("a")).toEqual({ status: "ready", data: 1 });
  });

  it("prévient les écrans et oublie les clés les plus anciennes", async () => {
    const source = new Source<number>("courses");
    const listener = vi.fn();
    source.subscribe(listener);
    for (let week = 0; week <= 20; week++) {
      source.refresh(String(week), "0", () => Promise.resolve(week));
    }
    await flush();
    // Au départ de chaque lecture, puis à chaque résultat, sauf celui de la clé oubliée.
    expect(listener).toHaveBeenCalledTimes(41);
    expect(source.get("0")).toBeUndefined();
    expect(source.get("20")).toEqual({ status: "ready", data: 20 });
  });

  it("dit qu'une lecture est en route jusqu'au résultat de la base", async () => {
    const source = new Source<number>("grades");
    expect(isStale(source.entry("a"), "0")).toBe(true);
    source.refresh("a", "0", () => Promise.resolve(1));
    expect(isStale(source.entry("a"), "0")).toBe(true);
    await flush();
    expect(isStale(source.entry("a"), "0")).toBe(false);
    // Les sujets ont changé (synchro) : relue, même avant que l'écran ne la redemande.
    expect(isStale(source.entry("a"), "1")).toBe(true);
  });
});
