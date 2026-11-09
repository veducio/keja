import type { SQL } from "bun";
import { ProjectError, projectError } from "../errors/framework-errors.ts";
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

export async function connectDatabase(databaseUrl: string) {
  const sql = await openClient(databaseUrl);
  try {
    await sql`select 1`;
  } catch (error) {
    await sql.close();
    throw asDatabaseError(error);
  }
  setDatabase(sql);
  return sql;
}

export async function migrateDatabase(directory: string, databaseUrl: string) {
  const sql = await openClient(databaseUrl);
  try {
    const applied = await applyMigrations(
      await loadMigrations(directory),
      adapter(sql),
    );
    return { migrations: directory, applied };
  } catch (error) {
    throw asDatabaseError(error);
  } finally {
    await sql.close();
  }
}

async function openClient(databaseUrl: string) {
  const { SQL } = await import("bun");
  try {
    return new SQL(readDatabaseUrl(databaseUrl));
  } catch (error) {
    throw asDatabaseError(error);
  }
}

function asDatabaseError(error: unknown): never {
  if (error instanceof ProjectError) {
    throw error;
  }
  const detail =
    error instanceof Error ? error.message : "Database connection failed";
  throw projectError("databaseInit", detail);
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
