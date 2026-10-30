// Évite d'ouvrir une console en plus sous Windows en release, ne pas retirer.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod database;
mod pronote_login;
mod secrets;

use std::{collections::HashSet, sync::Mutex};

use tauri::{AppHandle, Manager, State, Url, ipc::CapabilityBuilder};
use tauri_plugin_autostart::MacosLauncher;

/// Argument du lancement à l'ouverture de session : Piéride démarre dans la barre des tâches.
const MINIMIZED: &str = "--minimized";

/// Origines ouvertes au plugin http pendant cette session.
#[derive(Default)]
struct AllowedInstances(Mutex<HashSet<String>>);

#[tauri::command]
async fn show_app(app: AppHandle) -> Result<(), String> {
    let main = app.get_webview_window("main").ok_or_else(|| {
        eprintln!("[show_app] Fenêtre main introuvable");
        "Fenêtre 'main' introuvable".to_string()
    })?;

    main.show().map_err(|e| {
        eprintln!("[show_app] Échec de show(): {e}");
        e.to_string()
    })?;

    Ok(())
}

/// Ouvre au plugin http l'adresse propre à un compte (instance PRONOTE, URL iCal…).
/// Les domaines fixes des services, eux, sont déclarés dans `capabilities/`.
/// Les erreurs sont des codes, traduits par l'interface (voir `instance_origin`).
#[tauri::command]
fn allow_instance(
    app: AppHandle,
    allowed: State<'_, AllowedInstances>,
    url: &str,
) -> Result<(), String> {
    let origin = instance_origin(url)?;
    let mut allowed = allowed.0.lock().map_err(|_| "instance_lock")?;
    if allowed.contains(&origin) {
        return Ok(());
    }
    app.add_capability(
        CapabilityBuilder::new("instance")
            .window("main")
            .permission_scoped("http:default", vec![format!("{origin}/*")], vec![]),
    )
    .map_err(|_| "instance_capability")?;
    allowed.insert(origin);
    Ok(())
}

/// L'utilisateur peut choisir d'ouvrir l'appli en mode réduit au démarrage du PC.
/// Cette commande permet au frontend de savoir si l'argument qui le permet a été spécifié.
#[tauri::command]
fn is_minimized() -> bool {
    std::env::args().any(|arg| arg == MINIMIZED)
}

/// Origine d'une URL HTTPS vers un nom de domaine public. Les erreurs sont des codes,
/// qui ne recopient jamais l'URL : elle peut contenir un jeton.
fn instance_origin(url: &str) -> Result<String, &'static str> {
    let url = Url::parse(url).map_err(|_| "invalid_url")?;
    if url.scheme() != "https" {
        return Err("https_required");
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("credentials_in_url");
    }
    // `domain()` vaut None pour une adresse IP.
    // ponytail: un domaine public qui pointe vers 127.0.0.1 passe quand même (DNS rebinding) ;
    // filtrer l'adresse résolue côté plugin si ça devient un risque réel.
    let host = url.domain().ok_or("ip_address")?;
    // Lettres, chiffres, tirets et points seulement : l'origine devient un motif d'URL
    // du plugin, où `*` serait un joker et `+` un motif invalide qui bloque tout le réseau.
    if host.ends_with('.')
        || !host
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'.')
    {
        return Err("invalid_domain");
    }
    if !host.contains('.') || host.ends_with(".localhost") || host.ends_with(".local") {
        return Err("local_domain");
    }
    Ok(url.origin().ascii_serialization())
}

/// Montre la fenêtre principale, même réduite ou cachée dans la barre des tâches.
fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn main() {
    tauri::Builder::default()
        // En premier : ouvrir Piéride une deuxième fois montre la fenêtre déjà lancée.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        // Sans la visibilité : c'est le lancement qui décide de montrer la fenêtre (`setup`).
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .skip_initial_state("main")
                .build(),
        )
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![MINIMIZED]),
        ))
        .manage(AllowedInstances::default())
        .setup(|app| {
            // Sans base, l'app s'ouvre quand même : le front affiche l'erreur (commandes `db_*` en échec).
            match tauri::async_runtime::block_on(database::open(app.handle())) {
                Ok(database) => {
                    app.manage(database);
                }
                Err(error) => eprintln!("base locale impossible à ouvrir : {error}"),
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            allow_instance,
            pronote_login::pronote_login,
            show_app,
            is_minimized,
            secrets::secret_get,
            secrets::secret_set,
            secrets::secret_delete,
            database::db_select,
            database::db_execute,
            database::db_batch,
            database::db_apply_migration
        ])
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
