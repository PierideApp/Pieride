// Erreurs des services. Elles remontent à l'AccountManager, qui décide du repli sur le cache.
// Leur message ne contient jamais de secret : URL masquée avec `redactUrl`, pas de jeton.

/** Identifiants refusés ou session expirée : il faut se reconnecter. */
export class AuthenticationError extends Error {
  name = "AuthenticationError";
}

/** Serveur injoignable, en panne ou domaine non autorisé. */
export class ServiceUnavailable extends Error {
  name = "ServiceUnavailable";
}

/** Le service demande une vérification en plus (question de sécurité, code reçu par SMS…). */
export class SecurityChallenge extends Error {
  name = "SecurityChallenge";
}
