import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyMigrations,
  loadMigrations,
  type MigrationClient,
  pendingMigrations,
} from "./migrate.ts";

describe("loadMigrations", () => {
  it("reads numbered sql files in order", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "keja-migrations-"));
    writeFileSync(path.join(directory, "0002_jobs.sql"), "select 2;\n");
    writeFileSync(path.join(directory, "0001_init.sql"), "select 1;\n");
    const files = await loadMigrations(directory);
    expect(files.map((file) => file.file)).toEqual([
      "0001_init.sql",
      "0002_jobs.sql",
    ]);
  });

  it("rejects a file that is not 0001_name.sql", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "keja-migrations-"));
    writeFileSync(path.join(directory, "init.sql"), "select 1;\n");
    await expect(loadMigrations(directory)).rejects.toThrow(
      "init.sql must use the form 0001_name.sql",
    );
  });

  it("rejects two files with the same number", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "keja-migrations-"));
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, "0001_init.sql"), "select 1;\n");
    writeFileSync(path.join(directory, "0001_again.sql"), "select 1;\n");
    await expect(loadMigrations(directory)).rejects.toThrow(
      "0001_again.sql and 0001_init.sql use migration number 0001",
    );
  });
});

describe("pendingMigrations", () => {
  it("skips an applied file and refuses a changed one", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "keja-migrations-"));
    writeFileSync(path.join(directory, "0001_init.sql"), "select 1;\n");
    const [file] = await loadMigrations(directory);
    if (!file) {
      throw new Error("missing migration");
    }
    expect(pendingMigrations([file], [])).toEqual([file]);
    expect(
      pendingMigrations([file], [{ id: file.file, checksum: file.checksum }]),
    ).toEqual([]);
    expect(() =>
      pendingMigrations([file], [{ id: file.file, checksum: "stale" }]),
    ).toThrow("0001_init.sql changed after it was applied");
  });
});

describe("applyMigrations", () => {
  it("runs only migrations that are not recorded", async () => {
    const ran: string[] = [];
    const applied = [{ id: "0001_init.sql", checksum: "same" }];
    const client: MigrationClient = {
      async unsafe(sql) {
        ran.push(sql);
      },
      async query() {
        return applied;
      },
      async begin(fn) {
        return fn({
          async unsafe(sql) {
            ran.push(sql);
          },
          async query() {
            return [];
          },
          async begin(inner) {
            return inner(client);
          },
        });
      },
    };
    const directory = mkdtempSync(path.join(tmpdir(), "keja-migrations-"));
    writeFileSync(path.join(directory, "0001_init.sql"), "select 1;\n");
    writeFileSync(path.join(directory, "0002_jobs.sql"), "select 2;\n");
    const files = await loadMigrations(directory);
    const first = files[0];
    if (!first) {
      throw new Error("missing migration");
    }
    applied[0] = { id: first.file, checksum: first.checksum };
    await expect(applyMigrations(files, client)).resolves.toEqual([
      "0002_jobs.sql",
    ]);
    expect(ran.some((sql) => sql.includes("select 2;"))).toBe(true);
    expect(ran.some((sql) => sql.includes("select 1;"))).toBe(false);
  });

  it("rolls back a migration that creates a table without an owned object", async () => {
    const ran: string[] = [];
    const client: MigrationClient = {
      async unsafe(sql) {
        ran.push(sql);
      },
      async query() {
        return [];
      },
      async begin(fn) {
        return fn({
          async unsafe(sql) {
            ran.push(sql);
            if (sql.includes("keja_owned_object_violations()")) {
              return [{ table_name: "notes", detail: "missing _id" }];
            }
            return [];
          },
          async query() {
            return [];
          },
          async begin(inner) {
            return inner(client);
          },
        });
      },
    };
    const directory = mkdtempSync(path.join(tmpdir(), "keja-migrations-"));
    writeFileSync(
      path.join(directory, "0001_init.sql"),
      "create table notes (message text);\n",
    );
    await expect(
      applyMigrations(await loadMigrations(directory), client),
    ).rejects.toThrow("notes missing _id");
    expect(ran.some((sql) => sql.includes("insert into keja_migrations"))).toBe(
      false,
    );
  });
});
