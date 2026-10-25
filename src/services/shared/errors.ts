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

/** Aucune connexion n'existe encore pour ce type de service : réessayer n'y changera rien. */
export class UnsupportedService extends Error {
  name = "UnsupportedService";
}

/** Le service demande une vérification en plus (question de sécurité, code reçu par SMS…). */
export class SecurityChallenge extends Error {
  name = "SecurityChallenge";
}
