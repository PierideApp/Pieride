//! La base locale : `pieride.db` dans le dossier de données de l'app, ouverte avec sqlx.
//! Le front n'y accède que par ces commandes, à travers Drizzle (`src/database/client.ts`).
//! Chaque connexion refuse ATTACH (et donc VACUUM INTO) : le front ne peut ni lire ni
//! créer d'autre fichier que cette base.

use std::fs::create_dir_all;

use libsqlite3_sys::{SQLITE_LIMIT_ATTACHED, sqlite3_limit};
use serde_json::Value;
use sqlx::{
    Connection, Pool, Row, Sqlite, SqliteConnection, TypeInfo, ValueRef,
    query::Query,
    sqlite::{
        SqliteArguments, SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteRow,
        SqliteSynchronous,
    },
};
use tauri::{AppHandle, Manager, State};

pub struct Database(Pool<Sqlite>);

type Params = Vec<Value>;

async fn forbid_attach(connection: &mut SqliteConnection) -> sqlx::Result<()> {
    let mut handle = connection.lock_handle().await?;
    // SAFETY : la poignée vient de sqlx et reste verrouillée pendant l'appel.
    unsafe { sqlite3_limit(handle.as_raw_handle().as_ptr(), SQLITE_LIMIT_ATTACHED, 0) };
    Ok(())
}

async fn connect(options: SqliteConnectOptions) -> sqlx::Result<Pool<Sqlite>> {
    SqlitePoolOptions::new()
        .after_connect(|connection, _| Box::pin(forbid_attach(connection)))
        .connect_with(options.foreign_keys(true).create_if_missing(true))
        .await
}

pub async fn open(app: &AppHandle) -> Result<Database, Box<dyn std::error::Error>> {
    let dir = app.path().app_data_dir()?;
    create_dir_all(&dir)?;
    // En WAL, NORMAL n'attend le disque qu'aux points de contrôle, pas à chaque écriture : la
    // base ne peut pas se corrompre, une coupure de courant perd au pire les dernières
    // écritures, que la synchro suivante refait.
    let options = SqliteConnectOptions::new()
        .filename(dir.join("pieride.db"))
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal);
    Ok(Database(connect(options).await?))
}

fn bind<'q>(
    query: Query<'q, Sqlite, SqliteArguments<'q>>,
    value: Value,
) -> Query<'q, Sqlite, SqliteArguments<'q>> {
    match value {
        Value::Null => query.bind(None::<String>),
        Value::Bool(value) => query.bind(value),
        Value::Number(number) => match number.as_i64() {
            Some(integer) => query.bind(integer),
            None => query.bind(number.as_f64()),
        },
        Value::String(text) => query.bind(text),
        // Tableaux et objets : en JSON, comme les colonnes `mode: "json"` de Drizzle.
        other => query.bind(other.to_string()),
    }
}

fn query(sql: &str, params: Params) -> Query<'_, Sqlite, SqliteArguments<'_>> {
    params.into_iter().fold(sqlx::query(sql), bind)
}

/// Une ligne en tableau, dans l'ordre des colonnes : ce qu'attend Drizzle, sans perdre
/// une colonne quand deux portent le même nom (jointures).
fn values(row: &SqliteRow) -> Vec<Value> {
    (0..row.len())
        .map(|i| {
            let Ok(raw) = row.try_get_raw(i) else {
                return Value::Null;
            };
            if raw.is_null() {
                return Value::Null;
            }
            match raw.type_info().name() {
                "INTEGER" => row.try_get_unchecked::<i64, _>(i).map(Value::from),
                "REAL" => row.try_get_unchecked::<f64, _>(i).map(Value::from),
                "BLOB" => row.try_get_unchecked::<Vec<u8>, _>(i).map(Value::from),
                _ => row.try_get_unchecked::<String, _>(i).map(Value::from),
            }
            .unwrap_or(Value::Null)
        })
        .collect()
}

/// Tout passe, ou rien : la transaction est annulée si une requête échoue.
async fn batch(pool: &Pool<Sqlite>, queries: Vec<(String, Params)>) -> sqlx::Result<()> {
    let mut transaction = pool.begin().await?;
    for (sql, params) in queries {
        query(&sql, params).execute(&mut *transaction).await?;
    }
    transaction.commit().await
}

/// drizzle-kit reconstruit une table en la supprimant : avec les clés étrangères actives,
/// la cascade viderait les tables liées. SQLite ignore ce réglage dans une transaction,
/// d'où une connexion à part : réglage coupé, transaction, vérification, réglage rétabli.
async fn apply_migration(pool: &Pool<Sqlite>, name: &str, sql: &str) -> sqlx::Result<()> {
    let mut connection = pool.acquire().await?;
    sqlx::query("PRAGMA foreign_keys = OFF")
        .execute(&mut *connection)
        .await?;
    let applied = async {
        let mut transaction = connection.begin().await?;
        sqlx::query(sql).execute(&mut *transaction).await?;
        if sqlx::query("PRAGMA foreign_key_check")
            .fetch_optional(&mut *transaction)
            .await?
            .is_some()
        {
            return Err(sqlx::Error::Protocol(format!(
                "la migration {name} casse une clé étrangère"
            )));
        }
        sqlx::query("INSERT INTO migrations VALUES (?, unixepoch())")
            .bind(name)
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await
    }
    .await;
    let restored = match applied {
        Ok(()) => sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&mut *connection)
            .await
            .map(drop),
        Err(error) => Err(error),
    };
    if restored.is_err() {
        // Jamais de connexion sans clés étrangères dans le pool : on la ferme.
        drop(connection.detach());
    }
    restored
}

fn text(error: sqlx::Error) -> String {
    error.to_string()
}

#[tauri::command]
pub async fn db_select(
    database: State<'_, Database>,
    sql: String,
    params: Params,
) -> Result<Vec<Vec<Value>>, String> {
    let rows = query(&sql, params)
        .fetch_all(&database.0)
        .await
        .map_err(text)?;
    Ok(rows.iter().map(values).collect())
}

#[tauri::command]
pub async fn db_execute(
    database: State<'_, Database>,
    sql: String,
    params: Params,
) -> Result<(), String> {
    query(&sql, params)
        .execute(&database.0)
        .await
        .map(drop)
        .map_err(text)
}

#[tauri::command]
pub async fn db_batch(
    database: State<'_, Database>,
    queries: Vec<(String, Params)>,
) -> Result<(), String> {
    batch(&database.0, queries).await.map_err(text)
}

#[tauri::command]
pub async fn db_apply_migration(
    database: State<'_, Database>,
    name: String,
    sql: String,
) -> Result<(), String> {
    apply_migration(&database.0, &name, &sql)
        .await
        .map_err(text)
}

#[cfg(test)]
mod tests {
    use super::{apply_migration, batch, connect, values};
    use serde_json::{Value, json};
    use sqlx::{Pool, Sqlite, sqlite::SqliteConnectOptions};

    /// Une base dans un fichier temporaire : en mémoire, chaque connexion aurait la sienne.
    fn with_pool(test: &str, run: impl AsyncFnOnce(Pool<Sqlite>)) {
        let path = std::env::temp_dir().join(format!("pieride-{test}-{}.db", std::process::id()));
        let _ = std::fs::remove_file(&path);
        tauri::async_runtime::block_on(async {
            let pool = connect(SqliteConnectOptions::new().filename(&path))
                .await
                .unwrap();
            run(pool.clone()).await;
            pool.close().await;
        });
        let _ = std::fs::remove_file(&path);
    }

    fn sql(text: &str, params: Vec<Value>) -> (String, Vec<Value>) {
        (text.to_string(), params)
    }

    async fn all(pool: &Pool<Sqlite>, text: &str) -> Vec<Vec<Value>> {
        let rows = sqlx::query(text).fetch_all(pool).await.unwrap();
        rows.iter().map(values).collect()
    }

    #[test]
    fn refuse_attach_et_vacuum_into() {
        with_pool("attach", async |pool| {
            let other = std::env::temp_dir().join("pieride-autre.db");
            for text in [
                format!("ATTACH DATABASE '{}' AS autre", other.display()),
                format!("VACUUM INTO '{}'", other.display()),
            ] {
                assert!(sqlx::query(&text).execute(&pool).await.is_err(), "{text}");
            }
            assert!(!other.exists());
        });
    }

    #[test]
    fn batch_annule_tout_si_une_requete_echoue() {
        with_pool("batch", async |pool| {
            let create =
                "CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER, x REAL, b INTEGER, j TEXT)";
            batch(&pool, vec![sql(create, vec![])]).await.unwrap();
            let insert = "INSERT INTO t VALUES (?, ?, ?, ?, ?)";
            let row = vec![
                json!("a"),
                json!(1_700_000_000_000_i64),
                json!(1.5),
                json!(true),
                json!([1]),
            ];
            let failing = vec![sql(insert, row.clone()), sql(insert, row.clone())];
            assert!(batch(&pool, failing).await.is_err());
            assert_eq!(
                all(&pool, "SELECT count(*) FROM t").await,
                vec![vec![json!(0)]]
            );

            batch(&pool, vec![sql(insert, row)]).await.unwrap();
            assert_eq!(
                all(&pool, "SELECT n, x, b, j, NULL FROM t").await,
                vec![vec![
                    json!(1_700_000_000_000_i64),
                    json!(1.5),
                    json!(1),
                    json!("[1]"),
                    Value::Null
                ]]
            );
        });
    }

    #[test]
    fn une_table_reconstruite_garde_ses_lignes_liees() {
        with_pool("migration", async |pool| {
            let setup = "CREATE TABLE migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);
                CREATE TABLE parent (id TEXT PRIMARY KEY);
                CREATE TABLE child (id TEXT, parent_id TEXT REFERENCES parent(id) ON DELETE CASCADE);
                INSERT INTO parent VALUES ('p');
                INSERT INTO child VALUES ('c', 'p');";
            sqlx::raw_sql(setup).execute(&pool).await.unwrap();

            // Ce que drizzle-kit écrit pour modifier une colonne de `parent`.
            let rebuild = "PRAGMA foreign_keys=OFF;
                CREATE TABLE __new_parent (id TEXT PRIMARY KEY, name TEXT);
                INSERT INTO __new_parent(id) SELECT id FROM parent;
                DROP TABLE parent;
                ALTER TABLE __new_parent RENAME TO parent;
                PRAGMA foreign_keys=ON;";
            apply_migration(&pool, "0001_rebuild", rebuild)
                .await
                .unwrap();
            assert_eq!(
                all(&pool, "SELECT id FROM child").await,
                vec![vec![json!("c")]]
            );

            // Une migration qui casse une clé étrangère est annulée.
            let broken = "INSERT INTO child VALUES ('x', 'absent')";
            assert!(apply_migration(&pool, "0002_broken", broken).await.is_err());
            assert_eq!(
                all(&pool, "SELECT name FROM migrations").await,
                vec![vec![json!("0001_rebuild")]]
            );

            // Les clés étrangères sont de nouveau actives : la cascade fonctionne.
            sqlx::query("DELETE FROM parent")
                .execute(&pool)
                .await
                .unwrap();
            assert_eq!(
                all(&pool, "SELECT count(*) FROM child").await,
                vec![vec![json!(0)]]
            );
        });
    }
}
