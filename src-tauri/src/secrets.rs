//! Secrets des services (mots de passe, jetons, cookies) dans le trousseau du système :
//! Trousseau macOS, Gestionnaire d'identification Windows, Secret Service sous Linux.
//! Rangés sous l'`id` du service lié. Les erreurs sont des codes : jamais le secret.

use keyring::{Entry, Error};
use tauri::{AppHandle, async_runtime::spawn_blocking};

type Result<T> = std::result::Result<T, &'static str>;

/// Les `id` sont des UUID créés par le front : rien d'autre n'est accepté.
fn valid_id(id: &str) -> bool {
    (1..=64).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
}

fn code(error: Error) -> &'static str {
    match error {
        Error::NoEntry => "not_found",
        Error::TooLong(..) => "too_long",
        Error::NoDefaultStore | Error::NoStorageAccess(_) | Error::PlatformFailure(_) => {
            "keyring_unavailable"
        }
        _ => "keyring_error",
    }
}

/// Le trousseau peut bloquer (déverrouillage, D-Bus) : hors du fil de l'interface.
async fn with_entry<T: Send + 'static>(
    app: AppHandle,
    id: String,
    action: impl FnOnce(Entry) -> keyring::Result<T> + Send + 'static,
) -> Result<T> {
    if !valid_id(&id) {
        return Err("invalid_id");
    }
    let service = app.config().identifier.clone();
    spawn_blocking(move || Entry::new(&service, &id).and_then(action).map_err(code))
        .await
        .map_err(|_| "keyring_error")?
}

#[tauri::command]
pub async fn secret_get(app: AppHandle, id: String) -> Result<Option<String>> {
    with_entry(app, id, |entry| match entry.get_password() {
        Err(Error::NoEntry) => Ok(None),
        other => other.map(Some),
    })
    .await
}

#[tauri::command]
pub async fn secret_set(app: AppHandle, id: String, value: String) -> Result<()> {
    with_entry(app, id, move |entry| entry.set_password(&value)).await
}

#[tauri::command]
pub async fn secret_delete(app: AppHandle, id: String) -> Result<()> {
    with_entry(app, id, |entry| match entry.delete_credential() {
        Err(Error::NoEntry) => Ok(()),
        other => other,
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::valid_id;

    #[test]
    fn accepte_un_uuid() {
        assert!(valid_id("3f2b8c1e-7d4a-4e9b-a1c2-5d6e7f8a9b0c"));
    }

    #[test]
    fn refuse_le_reste() {
        for id in ["", "../autre-app", "a b", "id;rm", "é", &"a".repeat(65)] {
            assert!(!valid_id(id), "{id} aurait dû être refusé");
        }
    }
}
