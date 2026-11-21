//! Pièces jointes des services : ouvertes depuis le cache (vidé au lancement), ou téléchargées
//! dans le dossier des téléchargements, rangées par compte, année, module et matière. Seulement des
//! documents, des images, des sons et des vidéos : jamais un programme ou un script, qui
//! s'exécuterait à l'ouverture. Les erreurs sont des codes : jamais le nom du fichier.
//!
//! Le dossier des téléchargements est la seule écriture hors du dossier de l'app. Il ne vient
//! que du sélecteur du système, validé par l'élève : la WebView ne donne jamais qu'un chemin
//! relatif, vérifié morceau par morceau.

use std::{
    fs,
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
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

/// Dans le dossier de données : le chemin du dossier choisi dans les Paramètres.
const CHOSEN: &str = "dossier-telechargements";

/// Dans les Documents, tant que l'élève n'en a pas choisi un autre.
const DEFAULT: &str = "Piéride";

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

const FORBIDDEN: &str = r#"<>:"/\|?*"#;

/// Windows retire les points et les espaces de la fin ; un point au début cache le fichier.
fn edge(c: char) -> bool {
    c == '.' || c.is_whitespace()
}

/// Un nom de fichier sûr sur les trois systèmes : sans dossier ni caractère interdit, 120
/// caractères au plus avant l'extension, gardée en minuscules. `None` si le type est refusé.
/// Repassé dans `safe_name`, il ne change plus (voir `relative`).
fn safe_name(name: &str) -> Option<String> {
    let base = name.rsplit(['/', '\\']).next().unwrap_or_default();
    let cleaned: String = base
        .chars()
        .filter(|c| !c.is_control() && !r#"<>:"|?*"#.contains(*c))
        .collect();
    let (stem, extension) = cleaned.trim_end_matches(edge).rsplit_once('.')?;
    let extension = extension.trim().to_ascii_lowercase();
    if !ALLOWED.contains(&extension.as_str()) {
        return None;
    }
    let stem: String = stem.trim_start_matches(edge).chars().take(120).collect();
    let stem = stem.trim_end_matches(edge);
    let stem = if stem.is_empty() {
        "piece-jointe".to_string()
    } else if RESERVED.contains(&stem.to_ascii_lowercase().as_str()) {
        format!("_{stem}")
    } else {
        stem.to_string()
    };
    Some(format!("{stem}.{extension}"))
}

/// Un nom de dossier sûr (compte, matière) : rien qui sorte du dossier, 80 caractères au plus.
/// Repassé dans `safe_folder`, il ne change plus (voir `relative`).
fn safe_folder(name: &str) -> Option<String> {
    let cleaned: String = name
        .chars()
        .filter(|c| !c.is_control() && !FORBIDDEN.contains(*c))
        .collect();
    let folder = cleaned.trim_matches(edge);
    let base = folder.split('.').next().unwrap_or_default();
    let folder = if RESERVED.contains(&base.to_ascii_lowercase().as_str()) {
        format!("_{folder}")
    } else {
        folder.to_string()
    };
    let short: String = folder.chars().take(80).collect();
    let short = short.trim_end_matches(edge);
    (!short.is_empty()).then(|| short.to_string())
}

/// Un chemin donné par le front, sous le dossier des téléchargements : chaque morceau doit
/// être tel que `safe_folder` et `safe_name` l'ont écrit, sinon il est refusé.
fn relative(path: &str) -> Result<PathBuf> {
    let parts: Vec<&str> = path.split('/').collect();
    let (name, folders) = parts.split_last().ok_or("invalid_path")?;
    if folders.is_empty()
        || safe_name(name).as_deref() != Some(*name)
        || folders
            .iter()
            .any(|folder| safe_folder(folder).as_deref() != Some(*folder))
    {
        return Err("invalid_path");
    }
    Ok(parts.iter().collect())
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

fn chosen(app: &AppHandle) -> Result<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|data| data.join(CHOSEN))
        .map_err(|_| "data_unavailable")
}

fn downloads(app: &AppHandle) -> Result<PathBuf> {
    if let Ok(file) = chosen(app)
        && let Ok(text) = fs::read_to_string(file)
        && Path::new(&text).is_absolute()
    {
        return Ok(PathBuf::from(text));
    }
    app.path()
        .document_dir()
        .or_else(|_| app.path().home_dir())
        .map(|folder| folder.join(DEFAULT))
        .map_err(|_| "data_unavailable")
}

/// Sous Windows, la marque « venu d'Internet » (Mark of the Web), comme pour un fichier
/// téléchargé par le navigateur : Office ouvre alors le document en mode protégé.
#[cfg(windows)]
fn mark_from_internet(path: &Path) {
    let mut stream = path.as_os_str().to_owned();
    stream.push(":Zone.Identifier");
    // Sans elle (disque FAT, réseau), le fichier s'ouvre quand même.
    let _ = fs::write(stream, "[ZoneTransfer]\r\nZoneId=3\r\n");
}

#[cfg(not(windows))]
fn mark_from_internet(_: &Path) {}

fn write(folder: &Path, name: &str, bytes: &[u8]) -> Result<PathBuf> {
    fs::create_dir_all(folder).map_err(|_| "write_failed")?;
    let path = folder.join(name);
    fs::write(&path, bytes).map_err(|_| "write_failed")?;
    mark_from_internet(&path);
    Ok(path)
}

fn same(path: &Path, bytes: &[u8]) -> bool {
    fs::metadata(path).is_ok_and(|meta| u64::try_from(bytes.len()) == Ok(meta.len()))
        && fs::read(path).is_ok_and(|content| content == bytes)
}

/// Où ranger `bytes` dans `folder` : un fichier identique déjà là (vrai), sinon `name` ou
/// `nom (2).pdf`… le premier libre. Le dossier est celui de l'élève : rien n'y est écrasé.
fn slot(folder: &Path, name: &str, bytes: &[u8]) -> (String, bool) {
    let (stem, extension) = name.rsplit_once('.').unwrap_or((name, ""));
    let mut candidate = name.to_string();
    let mut count = 2;
    loop {
        let path = folder.join(&candidate);
        if !path.exists() {
            return (candidate, false);
        }
        if same(&path, bytes) {
            return (candidate, true);
        }
        candidate = format!("{stem} ({count}).{extension}");
        count += 1;
    }
}

/// La date du cours, du devoir ou de l'actualité : l'explorateur trie alors les fichiers dans
/// l'ordre de l'année.
fn set_date(path: &Path, date: SystemTime) {
    if let Ok(file) = fs::File::options().write(true).open(path) {
        let _ = file.set_modified(date);
    }
}

/// Seulement ce que Piéride a écrit. Faux si un fichier n'a pas pu partir (ouvert ailleurs).
fn delete(root: &Path, paths: &[String]) -> bool {
    let mut done = true;
    for file in paths
        .iter()
        .filter_map(|path| relative(path).ok())
        .map(|path| root.join(path))
    {
        match fs::remove_file(&file) {
            Ok(()) => tidy(root, &file),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => done = false,
        }
    }
    done
}

/// Les dossiers du compte et de la matière, s'ils sont restés vides.
fn tidy(root: &Path, file: &Path) {
    for folder in file
        .ancestors()
        .skip(1)
        .take_while(|folder| *folder != root)
    {
        if fs::remove_dir(folder).is_err() {
            break;
        }
    }
}

/// En-tête `name` : le nom du fichier, encodé pour l'URL.
fn received(request: &Request<'_>) -> Result<(String, Vec<u8>)> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("invalid_body");
    };
    if bytes.len() > MAX_SIZE {
        return Err("too_large");
    }
    let name = header(request, "name")
        .and_then(percent_decode)
        .ok_or("invalid_name")?;
    let name = safe_name(&name).ok_or("type_refused")?;
    Ok((name, bytes.clone()))
}

fn header<'a>(request: &'a Request<'_>, key: &str) -> Option<&'a str> {
    request
        .headers()
        .get(key)
        .and_then(|value| value.to_str().ok())
}

/// En-tête `service` en plus : l'`id` du service lié, son dossier dans le cache.
#[tauri::command]
pub async fn attachment_open(app: AppHandle, request: Request<'_>) -> Result<()> {
    let (name, bytes) = received(&request)?;
    let service = header(&request, "service")
        .filter(|id| valid_id(id))
        .ok_or("invalid_id")?;
    let target = opened(&app)?.join(service);
    let path = spawn_blocking(move || write(&target, &name, &bytes))
        .await
        .map_err(|_| "write_failed")??;
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(|_| "open_failed")
}

/// En-têtes en plus : `folders`, les dossiers où le ranger (chacun encodé pour l'URL, séparés
/// par des `/`), et `date`, en millisecondes. Renvoie son chemin sous le dossier des
/// téléchargements.
#[tauri::command]
pub async fn attachment_save(app: AppHandle, request: Request<'_>) -> Result<String> {
    let (name, bytes) = received(&request)?;
    let folders = header(&request, "folders")
        .and_then(|value| {
            value
                .split('/')
                .map(|part| percent_decode(part).and_then(|part| safe_folder(&part)))
                .collect::<Option<Vec<_>>>()
        })
        .filter(|folders| (1..=5).contains(&folders.len()))
        .ok_or("invalid_name")?;
    let date = header(&request, "date")
        .and_then(|millis| millis.parse().ok())
        .and_then(|millis| UNIX_EPOCH.checked_add(Duration::from_millis(millis)));
    let target = folders
        .iter()
        .fold(downloads(&app)?, |path, folder| path.join(folder));
    spawn_blocking(move || {
        fs::create_dir_all(&target).map_err(|_| "write_failed")?;
        let (name, present) = slot(&target, &name, &bytes);
        if !present {
            let path = target.join(&name);
            fs::write(&path, &bytes).map_err(|_| "write_failed")?;
            mark_from_internet(&path);
            if let Some(date) = date {
                set_date(&path, date);
            }
        }
        Ok(format!("{}/{name}", folders.join("/")))
    })
    .await
    .map_err(|_| "write_failed")?
}

/// `not_found` si le fichier n'est plus là.
#[tauri::command]
pub async fn attachment_saved_open(app: AppHandle, path: String, reveal: bool) -> Result<()> {
    let path = downloads(&app)?.join(relative(&path)?);
    if !path.is_file() {
        return Err("not_found");
    }
    if reveal {
        app.opener().reveal_item_in_dir(path)
    } else {
        app.opener().open_path(path.to_string_lossy(), None::<&str>)
    }
    .map_err(|_| "open_failed")
}

/// Pour chaque chemin : le chemin complet et la taille du fichier, ou `None` s'il a été
/// déplacé ou effacé à la main.
#[tauri::command]
pub async fn attachments_info(
    app: AppHandle,
    paths: Vec<String>,
) -> Result<Vec<Option<(String, u64)>>> {
    let root = downloads(&app)?;
    spawn_blocking(move || {
        paths
            .iter()
            .map(|path| {
                let file = root.join(relative(path).ok()?);
                let meta = fs::metadata(&file).ok().filter(|meta| meta.is_file())?;
                Some((file.to_string_lossy().into_owned(), meta.len()))
            })
            .collect()
    })
    .await
    .map_err(|_| "read_failed")
}

/// Efface des fichiers téléchargés (une année, depuis les Paramètres).
#[tauri::command]
pub async fn attachments_delete(app: AppHandle, paths: Vec<String>) -> Result<()> {
    let root = downloads(&app)?;
    spawn_blocking(move || delete(&root, &paths))
        .await
        .map_err(|_| "delete_failed")?
        .then_some(())
        .ok_or("delete_failed")
}

/// Efface les pièces jointes ouvertes d'un service délié ou d'un compte retiré, et celles
/// téléchargées (`paths`) : jamais rien d'autre dans le dossier de l'élève.
#[tauri::command]
pub async fn attachments_forget(app: AppHandle, service: String, paths: Vec<String>) -> Result<()> {
    if !valid_id(&service) {
        return Err("invalid_id");
    }
    let cache = opened(&app)?.join(&service);
    let root = downloads(&app)?;
    spawn_blocking(move || {
        match fs::remove_dir_all(cache) {
            Err(error) if error.kind() != std::io::ErrorKind::NotFound => {
                return Err("delete_failed");
            }
            _ => {}
        }
        delete(&root, &paths);
        Ok(())
    })
    .await
    .map_err(|_| "delete_failed")?
}

#[tauri::command]
pub fn downloads_folder(app: AppHandle) -> Result<String> {
    Ok(downloads(&app)?.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn downloads_folder_open(app: AppHandle) -> Result<()> {
    let root = downloads(&app)?;
    fs::create_dir_all(&root).map_err(|_| "open_failed")?;
    app.opener()
        .open_path(root.to_string_lossy(), None::<&str>)
        .map_err(|_| "open_failed")
}

/// Le sélecteur de dossier du système, sur le fil principal comme le veulent macOS et GTK.
async fn pick_folder(app: &AppHandle, title: String, start: PathBuf) -> Option<PathBuf> {
    let (sender, receiver) = std::sync::mpsc::channel();
    let window = app.get_webview_window("main");
    app.run_on_main_thread(move || {
        let mut dialog = rfd::AsyncFileDialog::new()
            .set_title(title)
            .set_directory(start);
        if let Some(window) = &window {
            dialog = dialog.set_parent(window);
        }
        let picking = dialog.pick_folder();
        tauri::async_runtime::spawn(async move {
            let _ = sender.send(picking.await.map(|folder| folder.path().to_path_buf()));
        });
    })
    .ok()?;
    spawn_blocking(move || receiver.recv().ok().flatten())
        .await
        .ok()
        .flatten()
}

/// Déplace un fichier téléchargé vers le nouveau dossier. Son nouveau chemin, ou `None` s'il
/// n'a pas pu suivre : il reste alors où il était.
fn relocate(old: &Path, new: &Path, path: &str) -> Option<String> {
    let relative = relative(path).ok()?;
    let (folders, name) = path.rsplit_once('/')?;
    let source = old.join(&relative);
    if !source.is_file() {
        return None;
    }
    let target = new.join(folders);
    fs::create_dir_all(&target).ok()?;
    let (name, present) = if target.join(name).exists() {
        slot(&target, name, &fs::read(&source).ok()?)
    } else {
        (name.to_string(), false)
    };
    let destination = target.join(&name);
    if present {
        let _ = fs::remove_file(&source);
    } else if fs::rename(&source, &destination).is_err() {
        // Vers un autre disque : copie, puis efface l'original.
        let date = fs::metadata(&source).and_then(|meta| meta.modified());
        if fs::copy(&source, &destination).is_err() {
            let _ = fs::remove_file(&destination);
            return None;
        }
        if let Ok(date) = date {
            set_date(&destination, date);
        }
        let _ = fs::remove_file(&source);
    }
    tidy(old, &source);
    Some(format!("{folders}/{name}"))
}

/// Ouvre le sélecteur, garde le dossier choisi et y déplace les fichiers déjà téléchargés
/// (`paths`). Renvoie leurs chemins dans le même ordre, ou `None` si l'élève a annulé.
#[tauri::command]
pub async fn downloads_folder_choose(
    app: AppHandle,
    title: String,
    paths: Vec<String>,
) -> Result<Option<Vec<String>>> {
    let old = downloads(&app)?;
    let title: String = title.chars().take(120).collect();
    let Some(new) = pick_folder(&app, title, old.clone()).await else {
        return Ok(None);
    };
    if !new.is_absolute() || !new.is_dir() {
        return Err("invalid_folder");
    }
    fs::write(chosen(&app)?, new.to_str().ok_or("invalid_folder")?).map_err(|_| "write_failed")?;
    if new == old {
        return Ok(Some(paths));
    }
    spawn_blocking(move || {
        paths
            .into_iter()
            .map(|path| relocate(&old, &new, &path).unwrap_or(path))
            .collect()
    })
    .await
    .map(Some)
    .map_err(|_| "write_failed")
}

/// Au lancement : les fichiers ouverts aux sessions d'avant ne servent plus.
pub fn clear(app: &AppHandle) {
    if let Ok(target) = opened(app) {
        // Absent, ou encore ouvert dans une autre app sous Windows : on réessaiera au prochain.
        let _ = fs::remove_dir_all(target);
    }
}

#[cfg(test)]
mod tests {
    use super::{percent_decode, relative, relocate, safe_folder, safe_name, slot};

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
    fn nettoie_un_nom_de_dossier() {
        assert_eq!(
            safe_folder(" Camille Test ").as_deref(),
            Some("Camille Test")
        );
        assert_eq!(safe_folder("Histoire/Géo").as_deref(), Some("HistoireGéo"));
        assert_eq!(safe_folder("..").as_deref(), None);
        assert_eq!(safe_folder("...").as_deref(), None);
        assert_eq!(safe_folder("aux.notes").as_deref(), Some("_aux.notes"));
        assert_eq!(safe_folder("Maths.").as_deref(), Some("Maths"));
    }

    #[test]
    fn relit_tout_chemin_qu_il_a_ecrit() {
        let long = format!("{} fin", "a".repeat(119));
        for (folder, name) in [
            (format!("aux.{}", "x".repeat(90)), format!("{long}.pdf")),
            (format!("{} .", "b".repeat(79)), "con.tar.PDF".to_string()),
            (" . Maths . ".to_string(), "  .. cours . .pdf".to_string()),
        ] {
            let path = format!(
                "{}/Maths/{}",
                safe_folder(&folder).unwrap(),
                safe_name(&name).unwrap()
            );
            assert!(relative(&path).is_ok(), "{path}");
        }
    }

    #[test]
    fn refuse_un_chemin_qui_sort_du_dossier() {
        assert!(relative("Camille Test/Maths/cours (2).pdf").is_ok());
        for path in [
            "cours.pdf",
            "../Maths/cours.pdf",
            "Camille/../../cours.pdf",
            "/etc/Maths/cours.pdf",
            "C:/Maths/cours.pdf",
            "Camille//cours.pdf",
            "Camille/Maths/virus.exe",
            "Camille\\..\\x/Maths/cours.pdf",
            "Camille/Maths/",
        ] {
            assert!(relative(path).is_err(), "{path}");
        }
    }

    #[test]
    fn n_ecrase_jamais_un_fichier() {
        let folder = std::env::temp_dir().join(format!("pieride-test-{}", std::process::id()));
        let old = folder.join("ancien");
        let new = folder.join("nouveau");
        std::fs::create_dir_all(old.join("Camille/Maths")).unwrap();
        std::fs::create_dir_all(new.join("Camille/Maths")).unwrap();
        std::fs::write(old.join("Camille/Maths/cours.pdf"), "a").unwrap();
        std::fs::write(new.join("Camille/Maths/cours.pdf"), "b").unwrap();
        std::fs::write(old.join("Camille/Maths/fiche.pdf"), "c").unwrap();
        std::fs::write(new.join("Camille/Maths/fiche.pdf"), "c").unwrap();

        let maths = new.join("Camille/Maths");
        assert_eq!(
            slot(&maths, "cours.pdf", b"d"),
            ("cours (2).pdf".into(), false)
        );
        assert_eq!(slot(&maths, "cours.pdf", b"b"), ("cours.pdf".into(), true));
        assert_eq!(
            relocate(&old, &new, "Camille/Maths/cours.pdf").as_deref(),
            Some("Camille/Maths/cours (2).pdf")
        );
        assert_eq!(
            std::fs::read_to_string(new.join("Camille/Maths/cours.pdf")).unwrap(),
            "b"
        );
        // Le même contenu : repris, pas copié en « (2) ».
        assert_eq!(
            relocate(&old, &new, "Camille/Maths/fiche.pdf").as_deref(),
            Some("Camille/Maths/fiche.pdf")
        );
        assert!(!maths.join("fiche (2).pdf").exists());
        // Les dossiers restés vides partent avec lui.
        assert!(!old.join("Camille").exists());
        assert_eq!(relocate(&old, &new, "Camille/Maths/cours.pdf"), None);
        std::fs::remove_dir_all(folder).unwrap();
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
