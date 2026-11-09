---
name: pieride-development
description: "À utiliser pour comprendre, modifier, corriger ou relire Piéride, en particulier les services scolaires, ÉcoleDirecte, la synchronisation, les modules React, la base SQLite, les paramètres ou les traductions. Décrit l'architecture réelle, les règles de données et de sécurité, et les étapes de travail propres au dépôt."
---

# Piéride : architecture et règles de développement

Ce skill décrit le fonctionnement de Piéride et les contraintes qui évitent les régressions entre l'interface, la synchronisation, les connecteurs scolaires et le stockage local. Il s'applique aux demandes qui touchent au code de l'application.

Le code et les README locaux restent la source de vérité. Si ce document devient obsolète, relire les fichiers indiqués et corriger le skill avec la modification. Ne pas extrapoler le comportement d'un service à partir de sa seule déclaration de capacité.

## 1. Résumé de l'application

Piéride est une application de bureau multiplateforme bâtie avec Tauri 2, React, TypeScript et Vite. Le front tourne dans une WebView. Rust fournit les opérations qui requièrent l'environnement natif : base SQLite, trousseau système, permissions réseau, ouverture de fenêtre et quelques intégrations de plateforme.

La base locale est la source de données affichée. Les connecteurs communiquent avec les ENT, traduisent leurs réponses vers des modèles Piéride communs, puis l'AccountManager persiste ces modèles. Les pages ne communiquent pas directement avec les ENT.

Stack actuelle : pnpm, TypeScript strict, React, React Router, Zustand, i18next, Drizzle ORM, SQLite et Tauri. Lire package.json avant d'ajouter ou de mettre à jour une dépendance.

## 2. Carte du dépôt

- src/app : démarrage, fenêtres, navigation, barre latérale, configuration et parcours de connexion.
- src/modules : pages scolaires, chacune dans un dossier dédié.
- src/components : composants d'interface réutilisables et système visuel.
- src/hooks : accès aux données locales et état d'interface partagé.
- src/services : AccountManager, modèles partagés et connecteurs d'ENT.
- src/database : schéma Drizzle, migrations et clients SQLite.
- src/stores : état d'interface Zustand. Les données scolaires n'y sont pas conservées.
- src/lib : réseau, trousseau, journal, dates, notes, HTML et utilitaires partagés.
- src/locales : dictionnaires de traduction fr.json et en.json.
- src-tauri : code Rust, commandes natives et permissions Tauri.
- docs/modules.md : règles de visibilité et d'enregistrement des modules.
- CONTRIBUTING.md : branches, commits et vérifications avant fusion.

Pour comprendre un parcours, lire d'abord les README des dossiers concernés. Ils précisent souvent des invariants qui ne sont pas visibles depuis le nom des fichiers.

## 3. Architecture des données : chemin obligatoire

Une donnée scolaire suit ce chemin :

1. Une page React appelle un hook partagé.
2. Le hook lit la base locale à travers useQuery et Drizzle.
3. Le store de synchronisation publie une nouvelle version du sujet concerné après écriture.
4. AccountManager choisit le service lié, ouvre ou réutilise son connecteur, demande la capability et normalise l'écriture.
5. Le connecteur appelle l'API du service et retourne les types partagés.
6. AccountManager enregistre les données et l'état de synchronisation ensemble dans SQLite.
7. Les hooks invalidés relisent la base, puis React affiche la nouvelle valeur.

Règle centrale : une page, un widget ou un composant visuel ne doit jamais appeler directement un connecteur, faire un fetch vers un ENT ou interpréter sa réponse. Ne pas ajouter un second chemin de données parallèle autour de l'AccountManager.

En pratique :

- Les services sont abstraits par src/services/shared/plugin.ts.
- Les formes normalisées sont dans src/services/shared/models.ts.
- L'orchestration et la persistance sont dans src/services/account-manager.ts.
- L'instance utilisée par l'application est créée dans src/services/index.ts.
- Les hooks déclarent les tables qu'ils lisent et les sujets qui les invalident.
- Les composants reçoivent des données prêtes à afficher, pas des objets propriétaires d'une bibliothèque ENT.

## 4. Contrat des services et des capabilities

Un service est un connecteur qui implémente le contrat SchoolServicePlugin et expose uniquement les méthodes associées aux capabilities qu'il sait réellement fournir. Le contrat détaillé est défini dans src/services/shared/plugin.ts.

Une capability représente une fonction complète, pas seulement un endpoint ou un nom de module. Par exemple, HOMEWORK requiert la lecture et la modification de l'état « fait »; GRADES requiert les périodes et le relevé d'une période. Ne pas déclarer une capability si une de ses méthodes obligatoires n'a pas de comportement valide.

Les modèles communs sont l'interface stable entre les connecteurs et le reste de Piéride : Course, Homework, Grade, PeriodGrades, News, Attendance et types de cantine. Ils doivent rester indépendants des types de BlocksDirecte, Pawnote ou d'autres bibliothèques.

Pour ajouter ou corriger un service :

1. Vérifier les modèles communs avant d'en créer un nouveau.
2. Lire l'API typée de la bibliothèque et le connecteur comparable déjà implémenté.
3. Isoler les appels externes et traduire la réponse dans src/services/<service>/.
4. Implémenter chaque méthode de la capability ou ne pas déclarer celle-ci.
5. Traduire les erreurs en erreurs partagées, sans propager un corps HTTP ou un secret.
6. Enregistrer le connecteur dans src/services/index.ts. Le chargement différé évite d'importer toutes les bibliothèques au démarrage.
7. Mettre à jour SERVICE_CAPABILITIES, les types, les écrans de connexion et les clés de traduction si nécessaire.
8. Confirmer les permissions réseau dans src-tauri/capabilities/default.json.
9. Garder les modules dépendants des capabilities, jamais du nom d'un fournisseur ENT.

Les dossiers présents dans un arbre ou une documentation ne prouvent pas à eux seuls qu'un connecteur est relié au démarrage. Vérifier src/services/index.ts et le connecteur réel.

## 5. Intégration ÉcoleDirecte

L'intégration se trouve principalement dans :

- src/services/ecoledirecte/session.ts : connexion, challenge de sécurité, session et rafraîchissement du jeton.
- src/services/ecoledirecte/data.ts : conversion des réponses vers les modèles communs et déclaration des capabilities.
- src/services/ecoledirecte/index.ts : point de connexion appelé par AccountManager.
- src/app/onboarding/ecoledirecte/EcoleDirecteFlow.tsx : écran de connexion, challenge, liaison de compte et première synchronisation.
- src/locales/fr.json et src/locales/en.json : libellés et erreurs du parcours.
- src-tauri/capabilities/default.json : permission réseau vers api.ecoledirecte.com.
- package.json et pnpm-lock.yaml : version de @blockshub/blocksdirecte.

### 5.1 Authentification et secrets

Le parcours appelle loginEcoledirecte. Il choisit le profil élève parmi les profils retournés par le compte. Quand ÉcoleDirecte impose une question de sécurité, le parcours conserve un challenge temporaire et reprend la connexion avec la réponse.

Le secret sérialisé actuellement conservé contient le nom d'utilisateur, le jeton d'accès, l'identifiant du profil, son type et l'identifiant d'appareil. Le mot de passe n'est pas enregistré après la connexion; le challenge peut le retenir temporairement dans une fermeture jusqu'à la fin du parcours.

Les secrets transitent par lib/keyring.ts et les commandes Rust de src-tauri/src/secrets.rs. Ils ne doivent jamais être copiés en SQLite, dans Zustand, localStorage, un log, une erreur affichée ou une capture de débogage.

Le connecteur rafraîchit la session et sauvegarde le jeton renouvelé via le callback saveSecret. Le rafraîchissement est partagé entre appels simultanés par pendingRefresh. Toute modification de session doit préserver cette déduplication et la rotation du jeton.

La bibliothèque utilise Buffer dans un environnement WebView; session.ts installe le polyfill attendu. Ne pas retirer ce pont sans vérifier les chemins qui encodent ou décodent Base64.

### 5.2 Capacités et normalisation

Le connecteur construit les capacités en fonction des modules du profil ÉcoleDirecte : EDT, CAHIER_DE_TEXTES, NOTES et VIE_SCOLAIRE. La bibliothèque vérifie la présence du code module; ne pas remplacer cette règle par une vérification du champ enable sans preuve dans son contrat.

Le connecteur convertit notamment :

- Emploi du temps : dates, matière, salle, professeur, groupe et annulation/modification.
- Devoirs : matière, contenu source conservé dans la base, dates et état fait. Le hook décode les contenus encodés et nettoie le HTML avant de les remettre à l'écran. Les devoirs de la semaine sont demandés par jour; un changement d'état appelle aussi l'API distante.
- Notes : périodes, notes, coefficients, barèmes, moyennes par matière et moyenne générale. Une note sans valeur peut porter un statut et ne doit pas être inventée comme une valeur numérique. La réponse ÉcoleDirecte peut omettre notes même si les périodes sont présentes : data.ts normalise alors null ou undefined en liste vide, mais refuse une réponse sans tableau periodes ou avec un type notes invalide afin de préserver le cache précédent.
- Actualités publiques : événements et postits de la timeline sont convertis en News puis triés par date. Le contenu source reste en HTML dans la base; le hook le décode et le nettoie avant affichage. Dans cette intégration, les éléments sont exposés comme lus, les pièces jointes ne sont pas renseignées et l'acquittement est une opération sans effet.
- Assiduité : absences et retards sont ramenés aux périodes, avec motif et statut justifié.

Les règles de conversion doivent rester dans data.ts, avec des fonctions explicites pour les nombres, les dates françaises, les identifiants et les champs manquants. Les dates invalides sont écartées ou signalées; ne pas les transformer silencieusement en « maintenant ».

La version 0.0.9-alpha de BlocksDirecte verrouillée dans ce dépôt avait une récursion dans le contrôle de profil : getSelectedAccountWithModuleName rappelait isModuleAvailableForSelectedAccount, qui rappelait à son tour getSelectedAccount. Le correctif est versionné dans patches/@blockshub__blocksdirecte@0.0.9-alpha.patch et déclaré dans pnpm-workspace.yaml. Il vérifie directement la présence du code module sur le profil courant. Conserver ce patch lors des mises à jour; ne pas contourner le contrôle en supprimant le code module.
L'API peut répondre HTTP 200 alors que la charge utile signale une erreur applicative ou ne correspond plus à la forme attendue par la bibliothèque. Un statut HTTP seul ne valide donc pas une synchronisation. Diagnostiquer le parseur, les champs et l'erreur originale sans journaliser le corps de réponse.

### 5.3 Limites fonctionnelles à garder visibles

L'implémentation actuelle est une adaptation des données accessibles via BlocksDirecte, pas une copie complète de l'application mobile ÉcoleDirecte. Ne pas annoncer une fonctionnalité tant que le connecteur, la capability, la persistance, le hook et l'interface ne la prennent pas tous en charge.

Les actualités sont limitées aux événements et postits de la timeline publique décrits ci-dessus. Les contenus composés uniquement de ponctuation sont supprimés par `newsContentToText`, y compris lors de la lecture des lignes déjà présentes en base; la liste masque leur extrait et le panneau montre une mention discrète quand aucun détail complémentaire n'est disponible. Les mappers gardent le HTML source; les hooks décodent les contenus encodés et nettoient le HTML avant de le remettre aux écrans. Pour améliorer l'affichage, comparer les champs réellement retournés par la bibliothèque et le modèle `News` avant de modifier la page. Ne jamais afficher du HTML brut fourni par l'ENT.

## 6. Synchronisation et comportement hors ligne

AccountManager applique le délai ordinaire de 30 minutes par capability. Le rafraîchissement manuel est limité à cinq minutes pour éviter de relancer un ENT à répétition. Cours et devoirs sont rangés par semaine; les autres semaines peuvent être chargées à la demande par loadWeek, avec une requête dédupliquée par service et lundi de semaine.

Lors d'une synchronisation :

- Chaque capability est tentée même si une autre échoue.
- Un échec d'ENT ne supprime pas les données déjà présentes dans SQLite.
- LastSync et les nouvelles données sont écrits atomiquement après un succès.
- Le type d'erreur est inscrit dans sync_state; une erreur d'authentification marque le service needsLogin.
- Une absence de capability signifie « non fourni » et ne doit pas effacer les données.
- Une erreur de base est différente d'une panne distante : ne pas la masquer comme si la synchro avait réussi.
- Le store de sync invalide les sujets après la fin afin que l'interface affiche l'état local le plus récent.

Les opérations qui modifient une donnée sur l'ENT (par exemple cocher un devoir) suivent l'ordre service distant, puis base locale. Si l'ENT échoue, ne pas faire croire à l'utilisateur que la modification a été persistée.

La gestion d'un service lié est conçue pour éviter un secret orphelin ou un compte sans secret : l'ajout en base est annulé si l'écriture du secret échoue; la suppression du secret précède la suppression du service. Préserver cet ordre lors d'une refactorisation.

Ne pas confondre ces états :

- Synchronisation en cours : une requête est active.
- Erreur de service : le cache reste disponible, mais certaines données ne sont pas à jour.
- Connexion à rétablir : les identifiants ont été refusés ou le jeton est invalide.
- Erreur locale : SQLite, trousseau ou commande native a échoué.

Pour les comportements de synchronisation, commencer dans src/services/account-manager.ts, puis src/stores/sync.ts et src/hooks/useLastSync.ts ou le hook de données concerné. Ne corrige pas seulement le texte d'état de la barre latérale si la cause est dans le connecteur ou la persistance.

## 7. Base locale et migrations

Le schéma Drizzle est défini dans src/database/schema.ts. Les migrations SQL sont dans src/database/migrations/ et sont appliquées au démarrage par src/database/migrate.ts. SQLite est exécuté côté Rust; le front utilise le client Drizzle en mode proxy.

Toute donnée liée à un ENT doit porter serviceId et référencer le service avec suppression en cascade, à moins que le modèle existant justifie explicitement une autre propriété. Les clés primaires et index doivent empêcher les doublons et soutenir les requêtes de hooks.

Si le schéma change :

1. Modifier schema.ts.
2. Générer la migration avec pnpm db:generate.
3. Examiner le SQL généré et les snapshots; vérifier les valeurs existantes et les clés étrangères.
4. Ajouter ou mettre à jour les tests de migration et de cascade correspondant au changement.
5. Ne pas éditer une migration générée à la main et ne pas réécrire une migration déjà livrée.
6. Utiliser db.batch pour grouper les écritures atomiques; le client ne fournit pas db.transaction standard.

Les commandes Rust db_* refusent l'attachement d'autres bases. Ne pas ajouter une commande qui contourne cette frontière ou lit arbitrairement des fichiers.

## 8. Réseau, permissions et sécurité

Toutes les requêtes vers des serveurs externes passent par src/lib/http.ts et tauri-plugin-http pour contourner les limites CORS de la WebView sous les permissions Tauri. Le fetch global est adapté pour les bibliothèques qui appellent directement fetch; des fetchers spécialisés sont fournis à celles qui acceptent un transport.

Règles réseau :

- Ajouter seulement les origines nécessaires dans src-tauri/capabilities/default.json.
- Une adresse d'instance donnée par l'utilisateur passe par allowInstance et ses validations Rust. Ne pas autoriser un wildcard plus large pour faciliter un test.
- Les redirections, signaux d'annulation et délais doivent rester cohérents entre les fetchers.
- Le journal réseau conserve le domaine, la méthode, le statut et la durée, pas le chemin sensible, les paramètres, les en-têtes d'authentification ou le corps.
- La réponse HTTP est consommée une seule fois par le fetcher qui la transforme en texte. Ne pas lire puis relire le même corps.
- Ne pas envelopper les objets Response natifs dans un Proxy et ne pas modifier leur prototype. Cela peut casser les méthodes qui dépendent de l'état interne de la WebView ou du plugin; diagnostiquer les piles RangeError avant d'ajouter un intercepteur.
- Ne pas désactiver la validation TLS, le filtrage des URL ni la liste d'autorisation pour « faire marcher » un ENT.
- Ne pas conserver l'URL complète d'une instance si elle contient un identifiant ou un jeton; les journaux doivent rester expurgés.

Les règles Rust de validation se trouvent dans src-tauri/src/main.rs et les commandes concernées. Les permissions d'une fenêtre sont explicites dans src-tauri/capabilities/. Toute nouvelle commande Tauri doit être enregistrée et autorisée avec le minimum de permissions.

## 9. Erreurs et diagnostic de synchronisation

Les erreurs partagées sont dans src/services/shared/errors.ts :

- AuthenticationError : identifiants ou session à renouveler.
- SecurityChallenge : vérification supplémentaire nécessaire.
- ServiceUnavailable : service distant injoignable, réponse inutilisable ou domaine non autorisé.
- UnsupportedService : connecteur ou capability indisponible.

Convertir les erreurs de bibliothèque au bord du connecteur. Ne pas faire remonter une exception qui pourrait inclure les jetons ou la réponse entière. Les journaux persistés doivent être des catégories, pas des contenus sensibles. Le diagnostic ÉcoleDirecte peut garder le nom de l'erreur, un message court et une première ligne de pile; jamais la réponse API.

Pour une erreur répétée de type ServiceUnavailable ou RangeError :

1. Vérifier si l'échec apparaît à l'ouverture de session ou sur une capability particulière.
2. Consulter le journal Piéride : catégorie, diagnostic limité et première frame; comparer avec la méthode de data.ts appelée.
3. Contrôler le statut HTTP, la durée et le domaine dans le journal réseau. HTTP 200 ne signifie pas que le contenu applicatif est valide.
4. Vérifier la version exacte de @blockshub/blocksdirecte et la forme de réponse attendue par cette version.
5. Isoler la première erreur TypeError/RangeError et sa frame; ne pas envelopper les réponses avec des Proxy pour observer les champs.
6. Vérifier que Response.text/json n'est pas consommé deux fois et que les transformations ne créent pas de boucle ou de référence récursive.
7. Confirmer les capabilities renvoyées par le profil et le code de module utilisé pour chacune.
8. Après la correction, vérifier le cache, lastError, lastSync et l'affichage du statut dans la barre latérale.

Ne pas marquer « synchronisation terminée » comme succès complet si refreshAll a signalé une capability en erreur. L'interface doit continuer à montrer les données en cache et indiquer l'échec clairement.

## 10. Hooks, stores et invalidation

Les hooks partagés de src/hooks lisent les tables locales et exposent l'état de chargement/erreur requis par l'écran. useQuery évite de relire inutilement la même source; ses sujets sont invalidés par les versions du store de synchronisation.

Après une écriture locale, appeler reload avec les sujets effectivement modifiés, par exemple homework après une tâche cochée. Une synchro complète incrémente les versions connues. Ajouter un nouveau sujet à TOPICS dans src/stores/sync.ts si une nouvelle table observable doit être invalidée.

Zustand stocke les préférences et l'état d'interface : compte sélectionné, apparence, modules masqués, tâches de sync en cours et détails ouverts. Les notes, actualités, cours, devoirs, absences et jetons n'y vont pas.

Avant d'ajouter un hook, consulter src/hooks/README.md et useQuery.ts. Éviter un état React local qui duplique une valeur calculée depuis la base ou un store.

## 11. Modules et navigation

Chaque page de barre latérale est déclarée dans src/modules/registry.ts. Un module s'organise dans src/modules/<id>/ et possède sa page, ses composants locaux, ses styles et au besoin ses helpers/tests.

Le registre définit l'identifiant, l'icône, la page, les capabilities requises, le groupe, le statut et une éventuelle pastille. L'identifiant sert aussi de chemin et de clé i18n modules.<id>. Les modules dont le statut est off restent cachés. Cours et Accueil sont toujours disponibles.

Pour ajouter un module :

1. Créer un dossier et une page sous src/modules/.
2. Consulter docs/modules.md pour le groupe et les règles de visibilité.
3. Ajouter son manifeste dans registry.ts et vérifier les chemins de navigation.
4. Définir ses capabilities, badge et état stable/beta/off correctement.
5. Lire les données avec des hooks et la base locale uniquement.
6. Ajouter ses clés dans fr.json et en.json.
7. Utiliser les composants partagés avant d'inventer de nouveaux contrôles.
8. Couvrir les règles pures de visibilité ou de calcul par les tests du module.

Ne pas coder en dur « si fournisseur == ÉcoleDirecte » dans un module pour décider s'il apparaît. Le registre doit rester agnostique au fournisseur.

## 12. Interface, styles et traductions

Les composants réutilisables se trouvent dans src/components et chaque module possède sa feuille SCSS module. Reprendre les conventions du voisin : couleurs de thème, espacements, états de chargement, états vides, erreurs, navigation clavier et taille de fenêtre.

Tout texte visible par l'utilisateur passe par useTranslation et i18next, même pour les erreurs, les états vides, les boutons et les infobulles. Ajouter les mêmes clés dans src/locales/fr.json et src/locales/en.json. Le français est la référence. Garder les clés structurées par zone existante et utiliser les interpolations i18next au lieu de concaténer des phrases.

Le contenu venant d'un ENT est non fiable. Nettoyer HTML avec src/lib/html.ts et afficher le résultat comme du texte. N'injecter pas du HTML distant dans React. Traiter les liens et pièces jointes selon les composants sécurisés existants.

L'interface doit distinguer un cache vide d'une donnée non chargée et d'une erreur de synchro. Les écrans doivent rester utilisables hors ligne. Une liste d'actualités doit montrer les champs réellement disponibles; masquer les chaînes Base64 ou les identifiants techniques au lieu de les présenter comme un résumé.

## 13. Modifications du front et des réglages

Avant d'ajouter un contrôle ou un réglage, vérifier comment les Paramètres sont structurés sous src/app/settings et les types persistés dans src/stores/settings.ts. Les préférences utilisateur vont dans le store existant si elles sont réellement de l'état d'interface, pas dans la base scolaire.

Pour les composants d'écran :

- Gérer chargement, résultat vide, erreur et contenu long.
- Garder les fonctions d'accès aux données hors des composants de présentation.
- Réutiliser les composants accessibles et les Dialog existants.
- Donner un libellé accessible aux champs, boutons d'icône et contrôles.
- Respecter les interactions clavier et les raccourcis définis par les hooks.
- Vérifier les petits formats de fenêtre et les longs textes ENT.

Pour les nouvelles pages de connexion, garder la validation et la traduction des erreurs proches du flow, mais laisser la sauvegarde et le cycle de vie du compte à AccountManager.

## 14. Qualité du code et dépendances

Le dépôt utilise ESLint, Prettier, TypeScript strict et simple-import-sort. Conserver les imports triés, les types explicites aux frontières réseau et base, les unions discriminées et les types exportés depuis les contrats communs.

Éviter any, les assertions de type non justifiées, les conversions de dates implicites et les valeurs par défaut qui masquent une donnée invalide. Préférer une fonction de mapping nommée à une transformation opaque.

Ajouter une dépendance seulement si une bibliothèque déjà installée ne couvre pas le besoin. Mettre à jour package.json et pnpm-lock.yaml ensemble avec pnpm; ne pas modifier le lockfile manuellement.

Le format du commit est documenté dans CONTRIBUTING.md et suit Conventional Commits, par exemple feat(notes): ajoute un filtre par période ou fix(sync): conserve le cache en cas de panne ENT.

## 15. Vérifications avant livraison

Pour un changement qui touche au code applicatif, les commandes documentées dans package.json sont :

    pnpm lint
    pnpm format:check
    pnpm typecheck
    pnpm test
    pnpm build

Après une modification Rust :

    cargo fmt
    cargo clippy

Après une modification SQL, vérifier aussi les migrations et les tests associés. Après une modification de droits Tauri, vérifier les identifiants de permissions et l'URL ciblée. N'affirmer qu'une vérification a réussi que si elle a réellement été exécutée dans cet état de travail.

Quand la demande porte seulement sur la documentation, ne pas lancer toute la suite applicative sans raison. Lire le diff et vérifier les liens et le format du document.

## 16. Parcours de travail conseillé

1. Lire le README, CONTRIBUTING.md et le README du dossier concerné.
2. Examiner le code actuel et ses tests; ne pas se fier à un ancien résumé de conversation.
3. Identifier la frontière touchée : UI, hook, modèle, connecteur, AccountManager, SQLite ou Rust.
4. Modifier le plus petit nombre de couches nécessaire, tout en maintenant le chemin complet de la donnée.
5. Ajouter les traductions et les migrations requises avec le changement fonctionnel.
6. Lire le diff complet pour repérer les modifications hors sujet ou générées.
7. Vérifier avec les commandes appropriées et rapporter précisément ce qui a été vérifié.
8. Mettre à jour ce skill quand une règle architecturale ou un invariant change.

## 17. Sources internes à consulter

- README.md : stack, commandes et arborescence.
- CONTRIBUTING.md : règles de contribution et validations.
- docs/modules.md : registre, capabilities et affichage de la barre latérale.
- src/services/README.md : connecteurs et AccountManager.
- src/services/shared/plugin.ts : contrat des services.
- src/services/shared/models.ts : modèles communs.
- src/services/account-manager.ts : synchronisation, cache et persistance.
- src/services/ecoledirecte/session.ts : authentification et cycle du jeton.
- src/services/ecoledirecte/data.ts : mapping ÉcoleDirecte.
- src/app/onboarding/ecoledirecte/EcoleDirecteFlow.tsx : parcours de connexion.
- src/database/README.md et src/database/schema.ts : persistance et migrations.
- src/hooks/README.md : hooks de données.
- src/stores/README.md et src/stores/sync.ts : état et invalidation.
- src/lib/README.md et src/lib/http.ts : réseau, journal et sécurité.
- src/locales/README.md : langues et traduction.
- src-tauri/capabilities/default.json : permissions réseau et fenêtre.
- src-tauri/src/secrets.rs et src-tauri/src/database.rs : frontières natives.
- Wiki du projet : [Architecture](https://github.com/PierideApp/Pieride/wiki/Architecture), [Ajouter un service](https://github.com/PierideApp/Pieride/wiki/Ajouter-un-service), [Conventions et qualité](https://github.com/PierideApp/Pieride/wiki/Conventions-et-qualit%C3%A9) et [Services](https://github.com/PierideApp/Pieride/wiki/Services). La page Services décrit l'avancement produit et peut être moins à jour que le code.
