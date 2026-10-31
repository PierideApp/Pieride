// Injecté au début de chaque page de la fenêtre de connexion PRONOTE (`pronote_login.rs`),
// d'après services/pronote/browser.tsx de Papillon (GPLv3) : https://github.com/PapillonApp/Papillon
// `pieride` est défini juste avant par Rust : { deviceUuid, base, returnUrl }.
(function () {
  // PRONOTE appelle ce crochet quand la page s'ouvre depuis son application mobile.
  window.hookAccesDepuisAppli = function () {
    this.passerEnModeValidationAppliMobile("", pieride.deviceUuid);
  };

  function whenLoaded(run) {
    if (document.readyState === "complete") {
      run();
    } else {
      window.addEventListener("load", run);
    }
  }

  function expiresIn(minutes) {
    return new Date(Date.now() + minutes * 60 * 1000).toUTCString();
  }

  // 1. InfoMobileApp.json : les cookies du mode application, puis la page de connexion.
  if (/\/infomobileapp\.json$/i.test(location.pathname)) {
    whenLoaded(function () {
      var cas = null;
      try {
        var info = JSON.parse(document.body.innerText);
        cas = info && info.CAS && info.CAS.jetonCAS;
      } catch (error) {
        // Pas de JSON lisible : la page de connexion s'ouvre quand même, sans ENT.
      }
      if (cas) {
        document.cookie = "appliMobile=; expires=" + new Date(0).toUTCString();
        document.cookie =
          "validationAppliMobile=" + cas + "; expires=" + expiresIn(5);
        document.cookie =
          "uuidAppliMobile=" + pieride.deviceUuid + "; expires=" + expiresIn(5);
      } else {
        document.cookie = "appliMobile=1; expires=" + expiresIn(5);
      }
      // 1036 : français.
      document.cookie = "ielang=1036; expires=" + expiresIn(365 * 24 * 60);
      location.assign(pieride.base + "/mobile.eleve.html?fd=1");
    });
    return;
  }

  // 2. Une fois connecté (directement ou par l'ENT), PRONOTE remplit `loginState` :
  // l'identifiant et le jeton partent vers l'adresse réservée, que Rust intercepte.
  whenLoaded(function () {
    try {
      window.GInterface.passerEnModeValidationAppliMobile(
        "",
        pieride.deviceUuid,
        "",
        "",
        '{"model":"random","platform":"android"}'
      );
    } catch (error) {
      // Page de l'ENT, ou PRONOTE pas encore prêt : le crochet ci-dessus prendra le relais.
    }
    var sent = false;
    setInterval(function () {
      var state = window.loginState;
      if (sent || !state || state.status !== 0 || !state.login || !state.mdp) {
        return;
      }
      sent = true;
      location.assign(
        pieride.returnUrl +
          "?" +
          new URLSearchParams({ login: state.login, token: state.mdp })
      );
    }, 1000);
  });
})();
