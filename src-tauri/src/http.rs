// Requêtes vers les instances des comptes (PRONOTE), avec une connexion gardée ouverte d'une
// requête à l'autre. Le plugin http crée un client par requête : une première synchro ouvrait
// une soixantaine de connexions d'affilée, et Windows en abandonnait certaines (après environ
// 21 s sans réponse). Mêmes adresses que le plugin : celles ouvertes par `allow_instance`.

use std::{
    collections::HashSet,
    sync::{Arc, Mutex},
    time::Duration,
};

use serde_json::{Value, json};
use tauri::State;
use tauri_plugin_http::reqwest::{
    self, Client, Method, Url,
    header::{HeaderMap, HeaderName, HeaderValue},
    redirect::Policy,
};

/// Au-delà, la requête est abandonnée : pawnote met en file les requêtes d'une session, une seule
/// sans réponse bloquerait toutes les autres.
const TIMEOUT: Duration = Duration::from_secs(60);

/// Comme le plugin http et le `fetch` du navigateur.
const MAX_REDIRECTIONS: usize = 10;

/// Origines ouvertes par `allow_instance` pendant ce lancement, partagées avec le plugin http.
#[derive(Clone, Default)]
pub struct AllowedInstances(pub Arc<Mutex<HashSet<String>>>);

impl AllowedInstances {
    /// Une adresse HTTPS, sans identifiants, vers une origine ouverte.
    fn allows(&self, url: &Url) -> bool {
        url.scheme() == "https"
            && url.username().is_empty()
            && url.password().is_none()
            && self
                .0
                .lock()
                .is_ok_and(|origins| origins.contains(&url.origin().ascii_serialization()))
    }
}

/// Deux clients, chacun avec ses connexions ouvertes : la redirection se règle par client.
pub struct InstanceClients {
    allowed: AllowedInstances,
    /// Suit les redirections, chacune vérifiée comme l'adresse de départ.
    follow: Client,
    /// Rend la redirection telle quelle (page de connexion de pawnote).
    manual: Client,
}

impl InstanceClients {
    pub fn new(allowed: AllowedInstances) -> reqwest::Result<Self> {
        let scope = allowed.clone();
        let follow = Client::builder()
            .timeout(TIMEOUT)
            .redirect(Policy::custom(move |attempt| {
                // `previous` commence par l'adresse de départ.
                if attempt.previous().len() > MAX_REDIRECTIONS {
                    attempt.error("too_many_redirects")
                } else if scope.allows(attempt.url()) {
                    attempt.follow()
                } else {
                    attempt.error("url_not_allowed")
                }
            }))
            .build()?;
        let manual = Client::builder()
            .timeout(TIMEOUT)
            .redirect(Policy::none())
            .build()?;
        Ok(Self {
            allowed,
            follow,
            manual,
        })
    }
}

/// La cause d'un échec, en code : le message de reqwest recopie l'URL, qui peut porter un jeton.
fn failure(error: &reqwest::Error) -> String {
    let code = if error.is_timeout() {
        "timeout"
    } else if error.is_connect() {
        "connect"
    } else if error.is_redirect() {
        "redirect"
    } else if error.is_body() || error.is_decode() {
        "body"
    } else {
        "network"
    };
    code.into()
}

/// Envoie une requête à une instance ouverte et rend `{ status, headers, content }`. En cas
/// d'échec, un code : `invalid_url`, `url_not_allowed`, `invalid_method`, `invalid_header`,
/// `timeout`, `connect`, `redirect`, `body` ou `network`.
#[tauri::command]
pub async fn instance_fetch(
    clients: State<'_, InstanceClients>,
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
    follow: bool,
) -> Result<Value, String> {
    let url = Url::parse(&url).map_err(|_| "invalid_url")?;
    if !clients.allowed.allows(&url) {
        return Err("url_not_allowed".into());
    }
    let method = match method.as_str() {
        "GET" => Method::GET,
        "POST" => Method::POST,
        _ => return Err("invalid_method".into()),
    };
    let mut map = HeaderMap::new();
    for (name, value) in headers {
        map.append(
            HeaderName::from_bytes(name.as_bytes()).map_err(|_| "invalid_header")?,
            HeaderValue::from_str(&value).map_err(|_| "invalid_header")?,
        );
    }
    let client = if follow {
        &clients.follow
    } else {
        &clients.manual
    };
    let mut request = client.request(method, url).headers(map);
    if let Some(body) = body {
        request = request.body(body);
    }
    let response = request.send().await.map_err(|error| failure(&error))?;
    let status = response.status().as_u16();
    let headers: Vec<(String, String)> = response
        .headers()
        .iter()
        .filter_map(|(name, value)| Some((name.to_string(), value.to_str().ok()?.to_string())))
        .collect();
    let bytes = response.bytes().await.map_err(|error| failure(&error))?;
    // Comme `Response.text()` du navigateur, que le plugin laissait faire : UTF-8 quoi que
    // dise l'en-tête, caractère de remplacement sur un octet invalide.
    let content = String::from_utf8_lossy(&bytes);
    Ok(json!({ "status": status, "headers": headers, "content": content }))
}

#[cfg(test)]
mod tests {
    use super::{AllowedInstances, Url};

    fn allowed() -> AllowedInstances {
        let allowed = AllowedInstances::default();
        allowed
            .0
            .lock()
            .expect("verrou neuf")
            .insert("https://0000000a.index-education.net".into());
        allowed
    }

    fn allows(url: &str) -> bool {
        allowed().allows(&Url::parse(url).expect("URL du test"))
    }

    #[test]
    fn accepte_une_instance_ouverte() {
        assert!(allows(
            "https://0000000a.index-education.net/pronote/appelfonction/3/42"
        ));
        assert!(allows("https://0000000A.index-education.net:443/pronote/"));
    }

    #[test]
    fn refuse_le_reste() {
        for url in [
            "http://0000000a.index-education.net/pronote/",
            "https://0000000a.index-education.net:8443/pronote/",
            "https://eleve:secret@0000000a.index-education.net/pronote/",
            "https://0000000b.index-education.net/pronote/",
            "https://index-education.net/",
            "https://0000000a.index-education.net.pirate.example/",
        ] {
            assert!(!allows(url), "{url}");
        }
    }
}
