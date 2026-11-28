import { log } from "@/lib/log";

export class AlreadyLinked extends Error {
  name = "AlreadyLinked";
}

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
  "AlreadyLinked",
  "InvalidSecurityAnswer",
]);

export function errorKey(error: unknown, prefix: string): string {
  const code = error instanceof Error ? error.name : error;
  if (typeof code === "string") {
    if (INSTANCE_CODES.has(code)) {
      return `errors.instance.${code}`;
    }
    if (LOGIN_ERRORS.has(code)) {
      return `${prefix}.errors.${code}`;
    }
    if (code === "keyring_unavailable") {
      return "errors.keyring_unavailable";
    }
  }
  logFailure("connexion", error);
  return "errors.Unknown";
}

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
