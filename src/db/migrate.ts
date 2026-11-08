import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ProjectError, projectError } from "../errors/framework-errors.ts";
import { ownedObjectSql, ownedObjectViolations } from "./owned-sql.ts";

const migrationFile = /^(\d{4,})_([A-Za-z0-9][A-Za-z0-9_-]*)\.sql$/;

export type MigrationFile = {
  id: string;
  number: number;
  file: string;
  sql: string;
  checksum: string;
};

export type AppliedMigration = {
  id: string;
  checksum: string;
};

export type MigrationClient = {
  unsafe(sql: string): Promise<unknown>;
  query(sql: string): Promise<AppliedMigration[]>;
  begin<T>(fn: (tx: MigrationClient) => Promise<T>): Promise<T>;
};

export async function loadMigrations(directory: string) {
  if (!existsSync(directory)) {
    throw projectError("missingMigrations", `Missing ${directory}`);
  }
  const names = await readdir(directory);
  const files: MigrationFile[] = [];
  for (const name of names) {
    const parsed = parseMigrationFile(name);
    if (!parsed || !(await stat(path.join(directory, name))).isFile()) {
      throw projectError(
        "invalidMigrationFile",
        `${name} must use the form 0001_name.sql`,
      );
    }
    const sql = await readFile(path.join(directory, name), "utf8");
    files.push({
      id: parsed.id,
      number: parsed.number,
      file: name,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
    });
  }
  files.sort(
    (left, right) =>
      left.number - right.number || left.file.localeCompare(right.file),
  );
  const seen = new Map<string, string>();
  for (const file of files) {
    const previous = seen.get(file.id);
    if (previous) {
      throw projectError(
        "duplicateMigration",
        `${previous} and ${file.file} use migration number ${file.id}`,
      );
    }
    seen.set(file.id, file.file);
  }
  return files;
}

export function pendingMigrations(
  files: readonly MigrationFile[],
  applied: readonly AppliedMigration[],
) {
  const checksums = new Map(applied.map((item) => [item.id, item.checksum]));
  const pending: MigrationFile[] = [];
  for (const file of files) {
    const checksum = checksums.get(file.file);
    if (checksum === undefined) {
      pending.push(file);
      continue;
    }
    if (checksum !== file.checksum) {
      throw projectError(
        "migrationChanged",
        `${file.file} changed after it was applied`,
      );
    }
  }
  return pending;
}

export async function applyMigrations(
  files: readonly MigrationFile[],
  client: MigrationClient,
) {
  await client.unsafe(ownedObjectSql);
  await client.unsafe(
    `create table if not exists keja_migrations (
      id text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )`,
  );
  const applied = await client.query(
    "select id, checksum from keja_migrations",
  );
  const pending = pendingMigrations(files, applied);
  for (const file of pending) {
    try {
      await client.begin(async (tx) => {
        await tx.unsafe(file.sql);
        const violations = ownedObjectViolations(
          await tx.unsafe(
            "select table_name, detail from keja_owned_object_violations()",
          ),
        );
        if (violations.length > 0) {
          throw projectError("ownedObject", violations.join("; "));
        }
        await tx.unsafe(
          `insert into keja_migrations (id, checksum) values ('${sqlLiteral(file.file)}', '${sqlLiteral(file.checksum)}')`,
        );
      });
    } catch (error) {
      if (error instanceof ProjectError) {
        throw error;
      }
      const detail =
        error instanceof Error ? error.message : "migration failed";
      throw projectError("migrationFailed", `${file.file} failed: ${detail}`);
    }
  }
  return pending.map((file) => file.file);
}

export function parseMigrationFile(file: string) {
  const match = migrationFile.exec(file);
  if (!match) {
    return null;
  }
  return { id: match[1], number: Number(match[1]), name: match[2] };
}

function sqlLiteral(value: string) {
  return value.replaceAll("'", "''");
}
