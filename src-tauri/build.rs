fn main() {
    // Déclarer les commandes maison les rend refusées par défaut : chaque fenêtre
    // doit les autoriser dans `capabilities/` (la future fenêtre ENT n'en aura aucune).
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["allow_instance"])),
    )
    .expect("failed to run tauri-build");
}
