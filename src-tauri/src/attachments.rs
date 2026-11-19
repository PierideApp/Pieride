//! Pièces jointes des services, un dossier par service : ouvertes depuis le cache (vidé au
//! lancement), ou téléchargées dans le dossier de données, une par sous-dossier. Seulement des
//! documents, des images, des sons et des vidéos : jamais un programme ou un script, qui
//! s'exécuterait à l'ouverture. Les erreurs sont des codes : jamais le nom du fichier.

use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

use tauri::{
    AppHandle, Manager,
    async_runtime::spawn_blocking,
    ipc::{InvokeBody, Request},
};
use tauri_plugin_opener::OpenerExt;

use crate::secrets::valid_id;

type Result<T> = std::result::Result<T, &'static str>;

const FOLDER: &str = "pieces-jointes";

/// Au-delà, le fichier est refusé : PRONOTE limite ses dépôts bien en dessous.
const MAX_SIZE: usize = 100 * 1024 * 1024;

/// Les types qui s'ouvrent. Les documents Office anciens peuvent porter des macros : Office et
/// LibreOffice les bloquent pour un fichier venu d'Internet (voir `mark_from_internet`).
const ALLOWED: &[&str] = &[
    "pdf", "txt", "rtf", "csv", "odt", "ods", "odp", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "png", "jpg", "jpeg", "gif", "webp", "heic", "mp3", "m4a", "wav", "ogg", "mp4", "mov", "webm",
];

/// Noms réservés par Windows, quelle que soit l'extension.
const RESERVED: &[&str] = &[
    "con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8",
    "com9", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
];

/// Un nom de fichier sûr sur les trois systèmes : sans dossier ni caractère interdit, 120
/// caractères au plus avant l'extension, gardée en minuscules. `None` si le type est refusé.
fn safe_name(name: &str) -> Option<String> {
    let base = name.rsplit(['/', '\\']).next().unwrap_or_default();
    let cleaned: String = base
        .chars()
        .filter(|c| !c.is_control() && !r#"<>:"|?*"#.contains(*c))
        .collect();
    // Windows retire les points de la fin ; un point au début cache le fichier.
    let (stem, extension) = cleaned.trim().trim_end_matches('.').rsplit_once('.')?;
    let extension = extension.trim().to_ascii_lowercase();
    if !ALLOWED.contains(&extension.as_str()) {
        return None;
    }
    let stem: String = stem
        .trim()
        .trim_start_matches('.')
        .trim()
        .chars()
        .take(120)
        .collect();
    let stem = if stem.is_empty() {
        "piece-jointe".to_string()
    } else if RESERVED.contains(&stem.to_ascii_lowercase().as_str()) {
        format!("_{stem}")
    } else {
        stem
    };
    Some(format!("{stem}.{extension}"))
}

/// `encodeURIComponent` à l'envers : un en-tête n'accepte que de l'ASCII.
fn percent_decode(text: &str) -> Option<String> {
    let mut bytes = Vec::with_capacity(text.len());
    let mut rest = text.bytes();
    while let Some(byte) = rest.next() {
        if byte == b'%' {
            let high = char::from(rest.next()?).to_digit(16)?;
            let low = char::from(rest.next()?).to_digit(16)?;
            bytes.push(u8::try_from(high * 16 + low).ok()?);
        } else {
            bytes.push(byte);
        }
    }
    String::from_utf8(bytes).ok()
}

fn opened(app: &AppHandle) -> Result<PathBuf> {
    app.path()
        .app_cache_dir()
        .map(|cache| cache.join(FOLDER))
        .map_err(|_| "cache_unavailable")
}

fn saved(app: &AppHandle) -> Result<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|data| data.join(FOLDER))
        .map_err(|_| "data_unavailable")
}

/// Sous Windows, la marque « venu d'Internet » (Mark of the Web), comme pour un fichier
/// téléchargé par le navigateur : Office ouvre alors le document en mode protégé.
#[cfg(windows)]
fn mark_from_internet(path: &Path) {
    let mut stream = path.as_os_str().to_owned();
    stream.push(":Zone.Identifier");
    // Sans elle (disque FAT, réseau), le fichier s'ouvre quand même.
    let _ = std::fs::write(stream, "[ZoneTransfer]\r\nZoneId=3\r\n");
}

#[cfg(not(windows))]
fn mark_from_internet(_: &Path) {}

fn write(folder: &Path, name: &str, bytes: &[u8]) -> Result<PathBuf> {
    std::fs::create_dir_all(folder).map_err(|_| "write_failed")?;
    let path = folder.join(name);
    std::fs::write(&path, bytes).map_err(|_| "write_failed")?;
    mark_from_internet(&path);
    Ok(path)
}

/// En-têtes : `service` (l'`id` du service lié), `name` (le nom du fichier, encodé pour l'URL).
fn received(request: &Request<'_>) -> Result<(String, String, Vec<u8>)> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("invalid_body");
    };
    if bytes.len() > MAX_SIZE {
        return Err("too_large");
    }
    let service = header(request, "service")
        .filter(|id| valid_id(id))
        .ok_or("invalid_id")?;
    let name = header(request, "name")
        .and_then(percent_decode)
        .ok_or("invalid_name")?;
    let name = safe_name(&name).ok_or("type_refused")?;
    Ok((service.to_string(), name, bytes.clone()))
}

fn header<'a>(request: &'a Request<'_>, key: &str) -> Option<&'a str> {
    request
        .headers()
        .get(key)
        .and_then(|value| value.to_str().ok())
}

#[tauri::command]
pub async fn attachment_open(app: AppHandle, request: Request<'_>) -> Result<()> {
    let (service, name, bytes) = received(&request)?;
    let target = opened(&app)?.join(service);
    let path = spawn_blocking(move || write(&target, &name, &bytes))
        .await
        .map_err(|_| "write_failed")??;
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(|_| "open_failed")
}

/// En-tête `folder` en plus : le sous-dossier, tiré de la clé de la pièce jointe par le front.
#[tauri::command]
pub async fn attachment_save(app: AppHandle, request: Request<'_>) -> Result<()> {
    let (service, name, bytes) = received(&request)?;
    let folder = header(&request, "folder")
        .filter(|id| valid_id(id))
        .ok_or("invalid_id")?;
    let target = saved(&app)?.join(service).join(folder);
    spawn_blocking(move || {
        remove(&target).map_err(|_| "write_failed")?;
        write(&target, &name, &bytes)
    })
    .await
    .map_err(|_| "write_failed")??;
    Ok(())
}

/// `not_found` si elle n'a pas été téléchargée, ou n'est plus là.
#[tauri::command]
pub async fn attachment_saved_open(
    app: AppHandle,
    service: String,
    folder: String,
    reveal: bool,
) -> Result<()> {
    if !valid_id(&service) || !valid_id(&folder) {
        return Err("invalid_id");
    }
    let target = saved(&app)?.join(service).join(folder);
    let path = spawn_blocking(move || file_in(&target))
        .await
        .map_err(|_| "not_found")?
        .ok_or("not_found")?;
    if reveal {
        app.opener().reveal_item_in_dir(path)
    } else {
        app.opener().open_path(path.to_string_lossy(), None::<&str>)
    }
    .map_err(|_| "open_failed")
}

/// Un sous-dossier vide : le fichier a été déplacé ou effacé à la main.
#[tauri::command]
pub async fn attachments_saved(app: AppHandle, service: String) -> Result<HashMap<String, bool>> {
    if !valid_id(&service) {
        return Err("invalid_id");
    }
    let target = saved(&app)?.join(service);
    spawn_blocking(move || {
        let Ok(entries) = std::fs::read_dir(target) else {
            return HashMap::new();
        };
        entries
            .flatten()
            .filter(|entry| entry.path().is_dir())
            .filter_map(|entry| {
                let present = file_in(&entry.path()).is_some();
                Some((entry.file_name().into_string().ok()?, present))
            })
            .collect()
    })
    .await
    .map_err(|_| "read_failed")
}

fn file_in(folder: &Path) -> Option<PathBuf> {
    std::fs::read_dir(folder)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .find(|path| path.is_file())
}

fn remove(target: &Path) -> std::io::Result<()> {
    match std::fs::remove_dir_all(target) {
        Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(error),
        _ => Ok(()),
    }
}

/// Efface les pièces jointes d'un service délié, ou d'un compte retiré.
#[tauri::command]
pub async fn attachments_forget(app: AppHandle, service: String) -> Result<()> {
    if !valid_id(&service) {
        return Err("invalid_id");
    }
    let targets = [opened(&app)?.join(&service), saved(&app)?.join(&service)];
    spawn_blocking(move || targets.iter().try_for_each(|target| remove(target)))
        .await
        .map_err(|_| "delete_failed")?
        .map_err(|_| "delete_failed")
}

/// Au lancement : les fichiers ouverts aux sessions d'avant ne servent plus.
pub fn clear(app: &AppHandle) {
    if let Ok(target) = opened(app) {
        // Absent, ou encore ouvert dans une autre app sous Windows : on réessaiera au prochain.
        let _ = std::fs::remove_dir_all(target);
    }
}

#[cfg(test)]
mod tests {
    use super::{percent_decode, safe_name};

    #[test]
    fn garde_un_document_et_nettoie_son_nom() {
        assert_eq!(
            safe_name("Fiche suites.PDF").as_deref(),
            Some("Fiche suites.pdf")
        );
        assert_eq!(
            safe_name("../../.bashrc/a<b>:c.docx").as_deref(),
            Some("abc.docx")
        );
        assert_eq!(
            safe_name("..\\x\\.pdf").as_deref(),
            Some("piece-jointe.pdf")
        );
        assert_eq!(safe_name("CON.txt").as_deref(), Some("_CON.txt"));
        assert_eq!(safe_name(".cache.png.").as_deref(), Some("cache.png"));
    }

    #[test]
    fn refuse_ce_qui_s_execute() {
        for name in [
            "virus.exe",
            "script.sh",
            "raccourci.desktop",
            "page.html",
            "dessin.svg",
            "archive.zip",
            "sans extension",
            "devoir.pdf.exe",
        ] {
            assert_eq!(safe_name(name), None, "{name}");
        }
    }

    #[test]
    fn decode_un_nom_encode_pour_l_url() {
        assert_eq!(
            percent_decode("R%C3%A8glement%20int%C3%A9rieur.pdf").as_deref(),
            Some("Règlement intérieur.pdf")
        );
        assert_eq!(percent_decode("a%2"), None);
        assert_eq!(percent_decode("%FF"), None);
    }
}
