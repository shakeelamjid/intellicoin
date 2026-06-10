import postgres from "postgres";

let _sql: ReturnType<typeof postgres> | null = null;

/** Lazily-created postgres.js client. Throws only when actually used without DATABASE_URL. */
export function db() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _sql = postgres(url, { max: 5, idle_timeout: 20 });
  }
  return _sql;
}
