//! Écritures groupées dans une vraie transaction. Le plugin sql n'en propose pas : il a
//! plusieurs connexions, et un `BEGIN` envoyé en SQL reste ouvert si une requête échoue,
//! ce qui bloque les écritures suivantes. Ici, sqlx annule tout en cas d'erreur.

use serde_json::Value;
use sqlx::{Pool, Sqlite, query::Query, sqlite::SqliteArguments};
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};

/// La base préchargée (tauri.conf.json) : la seule que cette commande touche.
const DATABASE: &str = "sqlite:pieride.db";

type Batch = Vec<(String, Vec<Value>)>;

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

/// Tout passe, ou rien : la transaction est annulée si une requête échoue.
async fn run(pool: &Pool<Sqlite>, queries: &Batch) -> sqlx::Result<()> {
    let mut transaction = pool.begin().await?;
    for (sql, params) in queries {
        let query = params.iter().cloned().fold(sqlx::query(sql), bind);
        query.execute(&mut *transaction).await?;
    }
    transaction.commit().await
}

/// Chaque élément : une requête et ses paramètres.
#[tauri::command]
pub async fn sql_batch(instances: State<'_, DbInstances>, queries: Batch) -> Result<(), String> {
    let instances = instances.0.read().await;
    let Some(DbPool::Sqlite(pool)) = instances.get(DATABASE) else {
        return Err("database_not_loaded".into());
    };
    run(pool, &queries).await.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::run;
    use serde_json::json;
    use sqlx::{Row, sqlite::SqlitePoolOptions};

    #[test]
    fn annule_tout_si_une_requete_echoue() {
        tauri::async_runtime::block_on(async {
            // Une seule connexion : en mémoire, chaque connexion aurait sa propre base.
            let pool = SqlitePoolOptions::new()
                .max_connections(1)
                .connect("sqlite::memory:")
                .await
                .unwrap();
            let sql = |s: &str, p| (s.to_string(), p);
            run(
                &pool,
                &vec![sql(
                    "CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER, x REAL, b INTEGER, j TEXT)",
                    vec![],
                )],
            )
            .await
            .unwrap();

            let insert = "INSERT INTO t VALUES (?, ?, ?, ?, ?)";
            let row = vec![
                json!("a"),
                json!(1_700_000_000_000_i64),
                json!(1.5),
                json!(true),
                json!([1]),
            ];
            let failing = vec![sql(insert, row.clone()), sql(insert, row.clone())];
            assert!(run(&pool, &failing).await.is_err());
            let count: i64 = sqlx::query("SELECT count(*) FROM t")
                .fetch_one(&pool)
                .await
                .unwrap()
                .get(0);
            assert_eq!(count, 0, "la première insertion aurait dû être annulée");

            // La connexion reste utilisable, et les types sont gardés.
            run(&pool, &vec![sql(insert, row)]).await.unwrap();
            let stored = sqlx::query("SELECT n, x, b, j, typeof(n) FROM t")
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(stored.get::<i64, _>(0), 1_700_000_000_000);
            assert_eq!(stored.get::<f64, _>(1), 1.5);
            assert!(stored.get::<bool, _>(2));
            assert_eq!(stored.get::<String, _>(3), "[1]");
            assert_eq!(stored.get::<String, _>(4), "integer");
        });
    }
}
