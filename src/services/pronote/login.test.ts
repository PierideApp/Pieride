import { describe, expect, it, vi } from "vitest";

import {
  parseCity,
  photoBlob,
  profilePhotoDataUrl,
  splitName,
  toSchool,
} from "./login";

vi.mock("@/lib/http", () => ({}));
vi.mock("@/lib/image", () => ({}));

describe("splitName", () => {
  it.each([
    ["MARTIN Camille", "Camille", "MARTIN"],
    ["LE GOFF Anne-Sophie", "Anne-Sophie", "LE GOFF"],
    ["D'ALMEIDA Léo", "Léo", "D'ALMEIDA"],
    ["Inès L’HOSTIS", "Inès", "L’HOSTIS"],
    ["Camille", "Camille", ""],
  ])("découpe %s", (name, firstName, lastName) => {
    expect(splitName(name)).toEqual({ firstName, lastName });
  });
});

describe("parseCity", () => {
  it("lit la commune et ses coordonnées", () => {
    expect(
      parseCity({
        type: "FeatureCollection",
        features: [
          {
            geometry: { type: "Point", coordinates: [-1.68, 48.11] },
            properties: { city: "Rennes", postcode: "35000" },
          },
        ],
      })
    ).toEqual({ name: "Rennes", latitude: 48.11, longitude: -1.68 });
  });

  it.each([
    null,
    { features: [] },
    { features: [{ properties: { city: "Rennes" } }] },
    { features: [{ geometry: { coordinates: ["x", 1] }, properties: {} }] },
  ])("refuse %o", json => {
    expect(parseCity(json)).toBeNull();
  });
});

describe("toSchool", () => {
  const school = {
    name: "ÉCOLE EXEMPLE",
    latitude: 48.85,
    longitude: 2.35,
    postalCode: 75001,
    distance: 1200,
  };

  it("nettoie l'adresse, même avec des espaces", () => {
    expect(
      toSchool({
        ...school,
        url: "https://0000000a .index-education.net/0000000a /pronoteprimaire",
      })?.url
    ).toBe("https://0000000a.index-education.net/0000000a/pronoteprimaire");
    expect(
      toSchool({
        ...school,
        url: "https://0000000a.index-education.net/pronote/",
      })?.url
    ).toBe("https://0000000a.index-education.net/pronote");
  });

  it("ignore une adresse illisible", () => {
    expect(toSchool({ ...school, url: "pas une adresse" })).toBeNull();
  });
});

describe("photoBlob", () => {
  it("décode une photo base64 de PRONOTE sans passer par le réseau", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const blob = await photoBlob(profilePhotoDataUrl("/9j/4AAQSkZJRg=="));
    expect(blob?.type).toBe("image/jpeg");
    expect([...new Uint8Array((await blob?.arrayBuffer()) ?? [])]).toEqual([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("ignore les retours à la ligne du base64", async () => {
    const blob = await photoBlob("data:image/png;base64,iVBO\nRw0K\r\nGgo=");
    expect(blob?.type).toBe("image/png");
  });

  it("refuse un data: qui n'est pas une image en base64", async () => {
    expect(await photoBlob("data:text/html;base64,PGI+")).toBeUndefined();
  });
});
