// La clé i18n d'une erreur de connexion : un code renvoyé par Rust (`allow_instance`,
// `pronote_login`, trousseau) ou une erreur des services. Jamais le message lui-même.
import { log } from "@/lib/log";

const INSTANCE_CODES = new Set([
  "invalid_url",
  "https_required",
  "credentials_in_url",
  "ip_address",
  "invalid_domain",
  "local_domain",
  "instance_lock",
  "instance_capability",
]);

const LOGIN_ERRORS = new Set([
  "login_open",
  "login_window",
  "AuthenticationError",
  "ServiceUnavailable",
  "SecurityChallenge",
  "LoginBlocked",
  "WrongPin",
]);

export function errorKey(error: unknown): string {
  const code = error instanceof Error ? error.name : error;
  if (typeof code === "string") {
    if (INSTANCE_CODES.has(code)) {
      return `errors.instance.${code}`;
    }
    if (LOGIN_ERRORS.has(code)) {
      return `onboarding.pronote.errors.${code}`;
    }
    if (code === "keyring_unavailable") {
      return "errors.keyring_unavailable";
    }
  }
  logFailure("connexion", error);
  return "errors.Unknown";
}

/**
 * Note une erreur : dans le journal (Paramètres > Développeur), masquée par `log`, et en dev
 * dans la console de la WebView, pour la comprendre.
 */
export function logFailure(source: string, error: unknown): void {
  log(
    "error",
    source,
    error instanceof Error
      ? `${error.name} ${error.message.slice(0, 200)}`
      : String(error).slice(0, 200)
  );
  if (import.meta.env.DEV) {
    console.error(error);
  }
}
