// Connexion d'un compte PRONOTE (premier lancement, ajout d'un compte, reconnexion), d'après
// les écrans services/pronote de Papillon (GPLv3) : recherche de l'établissement, page de
// connexion dans une fenêtre à part (src-tauri/src/pronote_login.rs), double authentification.
// Le mot de passe reste dans cette fenêtre : Piéride n'en reçoit que l'identifiant et le jeton.
import {
  AccountKind,
  cleanURL,
  createSessionHandle,
  DoubleAuthMode,
  finishLoginManually,
  type GeolocatedInstance,
  geolocation,
  instance,
  loginCredentials,
  loginToken,
  type RefreshInformation,
  securityCheckPIN,
  SecurityError,
  securitySave,
  securitySource,
  type SessionHandle,
} from "@blockshub/pawnote-lts";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

import { allowInstance, fetcher, pronoteFetcher } from "@/lib/http";
import { resizeImage } from "@/lib/image";
import { ServiceUnavailable } from "@/services/shared/errors";
import type { Account } from "@/services/shared/models";

import { type PronoteSecret, toServiceError } from "./session";

/** Le nom de Piéride dans la liste des appareils connus de PRONOTE (30 caractères au plus). */
const DEVICE_NAME = "Piéride";
/** Le libellé de la fenêtre de connexion, le même que dans pronote_login.rs. */
const LOGIN_WINDOW = "pronote-login";

/** L'URL de l'instance de démonstration PRONOTE. */
const demoURL = "https://demo.index-education.net/pronote"

/** PRONOTE demande un nouveau mot de passe ou de choisir sa double authentification. */
export class LoginBlocked extends Error {
  name = "LoginBlocked";
}

/** Le code PIN de la double authentification est faux. */
export class WrongPin extends Error {
  name = "WrongPin";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** La première commune d'une réponse de la Géoplateforme (GeoJSON), ou `null`. */
export function parseCity(
  json: unknown
): { name: string; latitude: number; longitude: number } | null {
  if (!isRecord(json) || !Array.isArray(json.features)) {
    return null;
  }
  const feature: unknown = json.features[0];
  if (!isRecord(feature) || !isRecord(feature.properties)) {
    return null;
  }
  const { geometry, properties } = feature;
  const coordinates: unknown =
    isRecord(geometry) && Array.isArray(geometry.coordinates)
      ? geometry.coordinates
      : null;
  if (
    !Array.isArray(coordinates) ||
    typeof coordinates[0] !== "number" ||
    typeof coordinates[1] !== "number" ||
    typeof properties.city !== "string"
  ) {
    return null;
  }
  return {
    name: properties.city,
    longitude: coordinates[0],
    latitude: coordinates[1],
  };
}

export interface School {
  name: string;
  /** L'adresse de l'instance, nettoyée. */
  url: string;
  postalCode: number;
  /** En mètres. */
  distance: number;
}

/**
 * Les établissements PRONOTE autour d'une ville : la commune vient de la Géoplateforme de
 * l'IGN (data.geopf.fr), les établissements d'Index Éducation. `null` : ville introuvable.
 */
export async function findSchools(
  query: string
): Promise<{ city: string; schools: School[] } | null> {
  const url = new URL("https://data.geopf.fr/geocodage/search");
  url.search = new URLSearchParams({
    q: query,
    index: "address",
    type: "municipality",
    limit: "1",
  }).toString();
  const response = await fetch(url);
  if (!response.ok) {
    throw new ServiceUnavailable(`Géoplateforme : ${response.status}`);
  }
  const city = parseCity(await response.json());
  if (!city) {
    return null;
  }
  try {
    const found = await geolocation(city, fetcher);
    return {
      city: city.name,
      schools: found.flatMap(school => toSchool(school) ?? []),
    };
  } catch (error) {
    throw toServiceError(error);
  }
}

/**
 * Un établissement de la recherche, ou `null` si son adresse est illisible. Index Éducation
 * renvoie parfois des espaces dans l'adresse (« https://0000000a .index-education.net/… ») :
 * une adresse n'en a jamais, ils sont retirés.
 */
export function toSchool(found: GeolocatedInstance): School | null {
  try {
    return {
      name: found.name,
      url: cleanURL(found.url.replace(/\s+/g, "")),
      postalCode: found.postalCode,
      distance: found.distance,
    };
  } catch {
    return null;
  }
}

export interface InstanceInfo {
  url: string;
  name: string;
  /** L'année de la version de PRONOTE (2025…). */
  version?: number;
  /** Le domaine de l'ENT, si la connexion passe par lui. */
  ent?: string;
}

/**
 * Lit l'instance d'une adresse collée : nettoyée (Piéride retire la fin de l'adresse), puis
 * ouverte au réseau. Rejetée avec un code de `allowInstance`, ou une erreur des services.
 */
export async function findInstance(input: string): Promise<InstanceInfo> {
  const text = input.trim();
  const url = cleanURL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
  await allowInstance(url);
  try {
    const found = await instance(url, pronoteFetcher);
    return {
      url,
      name: found.name,
      version: found.version[0],
      ent: found.casURL && new URL(found.casURL).hostname,
    };
  } catch (error) {
    throw toServiceError(error);
  }
}

export interface EntCredentials {
  login: string;
  token: string;
}

/**
 * Ouvre la fenêtre de connexion et attend : l'identifiant et le jeton, ou `null` si elle est
 * fermée avant. En cas de refus, la promesse est rejetée avec un code : ceux de
 * `allowInstance`, `invalid_device`, `invalid_title`, `login_open` (déjà ouverte, elle passe
 * au premier plan) ou `login_window`.
 */
export const openEntLogin = (url: string, deviceUuid: string, title: string) =>
  invoke<EntCredentials | null>("pronote_login", { url, deviceUuid, title });

/** Ferme la fenêtre de connexion si elle est ouverte : `openEntLogin` rend alors `null`. */
export async function closeEntLogin(): Promise<void> {
  await (await WebviewWindow.getByLabel(LOGIN_WINDOW))?.close();
}

/**
 * Prénom et nom depuis le nom PRONOTE (« MARTIN Camille ») : le nom est en capitales. D'après
 * utils/pronote/name.ts de Papillon (GPLv3), avec en plus les noms en D', L' ou O'.
 */
export function splitName(name: string): {
  firstName: string;
  lastName: string;
} {
  const lastName =
    /(?:[A-ZÀ-ÖØ-Þ]['’])?[A-ZÀ-ÖØ-Þ]{2,}(?:[\s'’-]+[A-ZÀ-ÖØ-Þ]{2,})*/.exec(
      name
    )?.[0];
  if (!lastName) {
    return { firstName: name.trim(), lastName: "" };
  }
  return { firstName: name.replace(lastName, "").trim(), lastName };
}

export interface PronoteLogin {
  secret: PronoteSecret;
  profile: Omit<Account, "id" | "avatar">;
  /** La photo de l'élève, sur l'instance, valable le temps de la session. */
  photoUrl?: string;
}

function loginOf(
  session: SessionHandle,
  refresh: RefreshInformation,
  deviceUUID: string
): PronoteLogin {
  const resource = session.user.resources.at(0);
  return {
    secret: {
      url: refresh.url,
      username: refresh.username,
      token: refresh.token,
      kind: refresh.kind,
      deviceUUID,
      navigatorIdentifier: refresh.navigatorIdentifier,
    },
    profile: {
      ...splitName(session.user.name),
      schoolName: resource?.establishmentName,
      className: resource?.className,
    },
    photoUrl: resource?.profilePicture?.url,
  };
}

export async function loginDemo(): Promise<{ kind: "done"; login: PronoteLogin }> {
  await allowInstance(demoURL)
  const session = createSessionHandle(pronoteFetcher);

  const refresh = await loginCredentials(session, {
    url: demoURL,
    kind: AccountKind.STUDENT,
    username: "demonstration",
    password: "pronotevs",
    deviceUUID: "0"
  })
  .catch(error => {
    throw toServiceError(error);
  })

  return { kind: "done", login: await loginOf(session, refresh, "0") };
}

/**
 * Première connexion avec ce que renvoie la fenêtre, une fois l'adresse ouverte au réseau
 * (rejetée sinon avec un code de `allowInstance`). Si PRONOTE veut seulement connaître
 * l'appareil, Piéride se déclare tout seul (comme Papillon) ; s'il demande le code PIN,
 * `finish` termine avec lui.
 */
export async function loginWithEnt(
  url: string,
  credentials: EntCredentials,
  deviceUUID: string
): Promise<
  | { kind: "done"; login: PronoteLogin }
  | { kind: "pin"; finish: (pin: string) => Promise<PronoteLogin> }
> {
  console.log("PRONOTE : Initialisation connexion, instance :", url)
  if(url === demoURL) { return loginDemo(); };
  await allowInstance(url);
  const session = createSessionHandle(pronoteFetcher);
  let challenge: SecurityError;
  try {
    const refresh = await loginToken(session, {
      url,
      kind: AccountKind.STUDENT,
      username: credentials.login,
      token: credentials.token,
      deviceUUID,
    });
    return { kind: "done", login: loginOf(session, refresh, deviceUUID) };
  } catch (error) {
    if (!(error instanceof SecurityError)) {
      throw toServiceError(error);
    }
    challenge = error;
  }
  const { handle } = challenge;
  if (handle.shouldCustomPassword || handle.shouldCustomDoubleAuth) {
    console.error("PRONOTE : Abandon connexion, l'utilisateur doit changer son mot de passe ou sa méthode de double authentification.")
    throw new LoginBlocked("À faire d'abord sur le site de PRONOTE");
  }
  const finish = async (pin?: string) => {
    try {
      if (pin !== undefined && !(await securityCheckPIN(session, pin))) {
        throw new WrongPin("Code PIN refusé");
      }
      await securitySource(session, DEVICE_NAME);
      await securitySave(
        session,
        handle,
        pin === undefined
          ? {
              mode: DoubleAuthMode.MGDA_NotificationSeulement,
              deviceName: DEVICE_NAME,
            }
          : { pin, deviceName: DEVICE_NAME }
      );
      const { authentication, identity, initialUsername } = handle.context;
      const refresh = await finishLoginManually(
        session,
        authentication,
        identity,
        initialUsername
      );
      return loginOf(session, refresh, deviceUUID);
    } catch (error) {
      throw toServiceError(error);
    }
  };
  return handle.shouldEnterPIN
    ? { kind: "pin", finish }
    : { kind: "done", login: await finish() };
}

/** La photo en URL `data:` (lib/image.ts), ou rien si elle ne se charge pas : elle est facultative. */
export async function loadPhoto(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url);
    return response.ok
      ? await resizeImage(await response.blob(), 256, { square: true })
      : undefined;
  } catch {
    return undefined;
  }
}
