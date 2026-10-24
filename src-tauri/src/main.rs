// Évite d'ouvrir une console en plus sous Windows en release, ne pas retirer.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{collections::HashSet, sync::Mutex};

use tauri::{AppHandle, Manager, State, Url, ipc::CapabilityBuilder};

/// Origines ouvertes au plugin http pendant cette session.
#[derive(Default)]
struct AllowedInstances(Mutex<HashSet<String>>);

/// Ouvre au plugin http l'adresse propre à un compte (instance PRONOTE, URL iCal…).
/// Les domaines fixes des services, eux, sont déclarés dans `capabilities/`.
#[tauri::command]
fn allow_instance(
    app: AppHandle,
    allowed: State<'_, AllowedInstances>,
    url: &str,
) -> Result<(), String> {
    let origin = instance_origin(url)?;
    let mut allowed = allowed
        .0
        .lock()
        .map_err(|_| "verrou des instances inutilisable")?;
    if allowed.contains(&origin) {
        return Ok(());
    }
    app.add_capability(
        CapabilityBuilder::new("instance")
            .window("main")
            .permission_scoped("http:default", vec![format!("{origin}/*")], vec![]),
    )
    .map_err(|e| e.to_string())?;
    allowed.insert(origin);
    Ok(())
}

/// Origine d'une URL HTTPS vers un nom de domaine public. Les erreurs ne recopient
/// jamais l'URL, qui peut contenir un jeton.
fn instance_origin(url: &str) -> Result<String, &'static str> {
    let url = Url::parse(url).map_err(|_| "URL invalide")?;
    if url.scheme() != "https" {
        return Err("HTTPS obligatoire");
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("identifiants interdits dans l'URL");
    }
    // `domain()` vaut None pour une adresse IP.
    // ponytail: un domaine public qui pointe vers 127.0.0.1 passe quand même (DNS rebinding) ;
    // filtrer l'adresse résolue côté plugin si ça devient un risque réel.
    let host = url.domain().ok_or("adresse IP refusée")?;
    // Lettres, chiffres, tirets et points seulement : l'origine devient un motif d'URL
    // du plugin, où `*` serait un joker et `+` un motif invalide qui bloque tout le réseau.
    if host.ends_with('.')
        || !host
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'.')
    {
        return Err("nom de domaine invalide");
    }
    if !host.contains('.') || host.ends_with(".localhost") || host.ends_with(".local") {
        return Err("domaine local refusé");
    }
    Ok(url.origin().ascii_serialization())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .manage(AllowedInstances::default())
        .invoke_handler(tauri::generate_handler![allow_instance])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::instance_origin;

    #[test]
    fn garde_l_origine_d_un_domaine_public() {
        assert_eq!(
            instance_origin("https://0000000a.index-education.net/pronote/eleve.html?login=true"),
            Ok("https://0000000a.index-education.net".into())
        );
        assert_eq!(
            instance_origin("https://Pronote.Exemple.FR:8443/"),
            Ok("https://pronote.exemple.fr:8443".into())
        );
    }

    #[test]
    fn refuse_le_reste() {
        for url in [
            "pas une url",
            "http://pronote.exemple.fr/",
            "https://eleve:secret@pronote.exemple.fr/",
            "https://jeton@pronote.exemple.fr/",
            "https://127.0.0.1/",
            "https://0x7f.1/",
            "https://[::1]/",
            "https://192.168.1.10/",
            "https://localhost/",
            "https://localhost./",
            "https://pronote.localhost/",
            "https://imprimante.local/",
            "https://intranet/",
            "https://*.*/",
            "https://(.*).exemple.fr/",
            "https://a+.fr/",
            "https://pronote.exemple.fr./",
            "file:///etc/passwd",
        ] {
            assert!(
                instance_origin(url).is_err(),
                "{url} aurait dû être refusée"
            );
        }
    }
}
