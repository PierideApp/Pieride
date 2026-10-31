fn main() {
    // Déclarer les commandes maison les rend refusées par défaut : chaque fenêtre
    // doit les autoriser dans `capabilities/` (la fenêtre ENT, `pronote_login.rs`, n'en a aucune).
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "allow_instance",
            "pronote_login",
            "show_app",
            "is_minimized",
            "secret_get",
            "secret_set",
            "secret_delete",
            "db_select",
            "db_execute",
            "db_batch",
            "db_apply_migration",
        ]),
    ))
    .expect("failed to run tauri-build");
}
