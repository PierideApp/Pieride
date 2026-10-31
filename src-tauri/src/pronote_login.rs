//! Connexion à PRONOTE par la page web de l'établissement (et son ENT), dans une fenêtre à
//! part, comme la page `services/pronote/browser.tsx` de Papillon (GPLv3).
//! La fenêtre n'a accès à aucune commande de l'app : aucune capability ne la nomme. Elle est
//! en navigation privée : rien de l'ENT ne reste sur le disque. Le script injecté renvoie
//! l'identifiant et le jeton de PRONOTE en naviguant vers une adresse réservée, que Rust
//! intercepte : le mot de passe ne quitte jamais la page.

use serde_json::{Value, json};
use tauri::{
    AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent, async_runtime,
    webview::{NewWindowResponse, PageLoadEvent},
};

use crate::{instance_origin, secrets::valid_id};

const LABEL: &str = "pronote-login";
/// Domaine réservé (RFC 2606) : jamais résolu, toute navigation vers lui est interceptée.
const RETURN_HOST: &str = "pieride.invalid";
/// Identifiant de l'application mobile PRONOTE, attendu par `InfoMobileApp.json` (Papillon).
const MOBILE_APP_ID: &str = "0D264427-EEFC-4810-A9E9-346942A862A4";
/// PRONOTE ne propose le mode application qu'à un navigateur mobile.
const USER_AGENT: &str = "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";
const SCRIPT: &str = include_str!("pronote_login.js");

type Result<T> = std::result::Result<T, &'static str>;

/// Ouvre la connexion et attend : `{ login, token }`, ou `null` si la fenêtre est fermée avant.
/// `url` est l'adresse de l'instance (`https://…/pronote`), `title` le titre traduit.
/// Les erreurs sont des codes : ceux de `instance_origin`, `invalid_device`, `invalid_title`,
/// `login_open` (une connexion est déjà ouverte, elle passe au premier plan) ou `login_window`.
#[tauri::command]
pub async fn pronote_login(
    app: AppHandle,
    url: String,
    device_uuid: String,
    title: String,
) -> Result<Option<Value>> {
    instance_origin(&url)?;
    let base = Url::parse(&url).map_err(|_| "invalid_url")?;
    if base.query().is_some() || base.fragment().is_some() {
        return Err("invalid_url");
    }
    if !valid_id(&device_uuid) {
        return Err("invalid_device");
    }
    if title.is_empty() || title.chars().count() > 100 {
        return Err("invalid_title");
    }
    if let Some(window) = app.get_webview_window(LABEL) {
        let _ = window.show();
        let _ = window.set_focus();
        return Err("login_open");
    }

    let mut info = base.clone();
    info.path_segments_mut()
        .map_err(|_| "invalid_url")?
        .pop_if_empty()
        .push("InfoMobileApp.json");
    info.set_query(Some(&format!("id={MOBILE_APP_ID}")));
    let settings = json!({
        "deviceUuid": device_uuid,
        "base": base.as_str().trim_end_matches('/'),
        "returnUrl": format!("https://{RETURN_HOST}/pronote"),
    });

    // Le premier résultat gagne : les identifiants, ou `None` à la fermeture de la fenêtre.
    let (sender, mut receiver) = async_runtime::channel(1);
    let on_return = sender.clone();
    let handle = app.clone();
    let popup = app.clone();
    let window = WebviewWindowBuilder::new(&app, LABEL, WebviewUrl::External(info))
        .title(title)
        .inner_size(480.0, 720.0)
        .center()
        .incognito(true)
        // Cachée tant qu'on est sur `InfoMobileApp.json` : sinon son JSON s'affiche un instant.
        .visible(false)
        .user_agent(USER_AGENT)
        .initialization_script(format!("var pieride = {settings};\n{SCRIPT}"))
        .on_navigation(move |target| {
            if target.host_str() != Some(RETURN_HOST) {
                return true;
            }
            if let Some(found) = credentials(target) {
                let _ = on_return.try_send(Some(found));
                with_window(&handle, |window| {
                    let _ = window.close();
                });
            }
            false
        })
        .on_page_load(|window, payload| {
            if matches!(payload.event(), PageLoadEvent::Finished) && !is_info_page(payload.url()) {
                async_runtime::spawn(async move {
                    let _ = window.show();
                    let _ = window.set_focus();
                });
            }
        })
        // Un ENT qui ouvre une fenêtre : la page s'ouvre à la place, comme dans Papillon.
        .on_new_window(move |target, _features| {
            if matches!(target.scheme(), "https" | "http") {
                with_window(&popup, move |window| {
                    let _ = window.navigate(target);
                });
            }
            NewWindowResponse::Deny
        })
        .build()
        .map_err(|_| "login_window")?;
    window.on_window_event(move |event| {
        if matches!(event, WindowEvent::Destroyed) {
            let _ = sender.try_send(None);
        }
    });
    Ok(receiver.recv().await.flatten())
}

/// Agit sur la fenêtre hors du gestionnaire en cours, qui tourne sur le fil de l'interface.
fn with_window(app: &AppHandle, action: impl FnOnce(tauri::WebviewWindow) + Send + 'static) {
    if let Some(window) = app.get_webview_window(LABEL) {
        async_runtime::spawn(async move { action(window) });
    }
}

/// La page de départ, qui pose les cookies puis ouvre la page de connexion.
fn is_info_page(url: &Url) -> bool {
    url.path()
        .to_ascii_lowercase()
        .ends_with("/infomobileapp.json")
}

/// L'identifiant et le jeton renvoyés par le script, s'ils ont la forme attendue.
fn credentials(url: &Url) -> Option<Value> {
    let (mut login, mut token) = (None, None);
    for (key, value) in url.query_pairs() {
        match key.as_ref() {
            "login" => login = Some(value.into_owned()),
            "token" => token = Some(value.into_owned()),
            _ => {}
        }
    }
    let (login, token) = (login?, token?);
    let plausible = |text: &str| (1..=1024).contains(&text.len());
    (plausible(&login) && plausible(&token)).then(|| json!({ "login": login, "token": token }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn read(url: &str) -> Option<Value> {
        credentials(&Url::parse(url).unwrap())
    }

    #[test]
    fn lit_l_identifiant_et_le_jeton() {
        assert_eq!(
            read("https://pieride.invalid/pronote?login=camille&token=a%2Bb"),
            Some(json!({ "login": "camille", "token": "a+b" }))
        );
    }

    #[test]
    fn reconnait_la_page_de_depart() {
        let url = |text: &str| Url::parse(text).unwrap();
        assert!(is_info_page(&url(
            "https://0000000a.index-education.net/pronote/InfoMobileApp.json?id=x"
        )));
        assert!(!is_info_page(&url(
            "https://0000000a.index-education.net/pronote/mobile.eleve.html?fd=1"
        )));
    }

    #[test]
    fn ignore_un_retour_incomplet() {
        assert_eq!(read("https://pieride.invalid/pronote?login=camille"), None);
        assert_eq!(read("https://pieride.invalid/pronote?login=&token=x"), None);
        let long = "x".repeat(1025);
        assert_eq!(
            read(&format!(
                "https://pieride.invalid/pronote?login=a&token={long}"
            )),
            None
        );
    }
}
