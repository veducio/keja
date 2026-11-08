import type { SQL } from "bun";
import { projectError } from "../errors/framework-errors.ts";
import { setDatabase } from "./client.ts";
import {
  type AppliedMigration,
  applyMigrations,
  loadMigrations,
  type MigrationClient,
} from "./migrate.ts";

export function readDatabaseUrl(value: string | undefined) {
  const url = value?.trim() ?? "";
  if (url === "") {
    throw projectError("databaseUrl", "DATABASE_URL is required");
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "postgres:" || parsed.protocol === "postgresql:") {
      return url;
    }
  } catch {
    throw projectError(
      "databaseUrl",
      "DATABASE_URL must be a postgres connection string",
    );
  }
  throw projectError(
    "databaseUrl",
    "DATABASE_URL must be a postgres connection string",
  );
}

export async function migrateDatabase(directory: string, databaseUrl: string) {
  const { SQL } = await import("bun");
  const sql = new SQL(readDatabaseUrl(databaseUrl));
  try {
    const applied = await applyMigrations(
      await loadMigrations(directory),
      adapter(sql),
    );
    setDatabase(sql);
    return { migrations: directory, applied };
  } catch (error) {
    await sql.close();
    throw error;
  }
}

function adapter(sql: SQL): MigrationClient {
  return {
    unsafe(statement) {
      return sql.unsafe(statement);
    },
    query(statement: string) {
      return sql.unsafe(statement) as Promise<AppliedMigration[]>;
    },
    begin(fn) {
      return sql.begin((tx) => fn(adapter(tx)));
    },
  };
}
