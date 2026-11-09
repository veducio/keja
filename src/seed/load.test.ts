import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createTypeId } from "../typeid/id.ts";
import { defineSeeder } from "./define.ts";
import {
  collectSeederFiles,
  readSeederFile,
  seedersFromModule,
} from "./load.ts";

describe("seed files", () => {
  it("walks seed modules and skips tests", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "keja-seed-"));
    mkdirSync(path.join(root, "billing"), { recursive: true });
    writeFileSync(path.join(root, "users.ts"), "");
    writeFileSync(path.join(root, "users.test.ts"), "");
    writeFileSync(path.join(root, "billing", "notes.ts"), "");
    const files = await collectSeederFiles(root);
    expect(files.sort()).toEqual(["billing/notes.ts", "users.ts"]);
  });

  it("reads every seeder export and rejects a file with none", () => {
    const users = defineSeeder({
      table: "users",
      objects: [owned("users")],
    });
    const notes = defineSeeder({
      table: "notes",
      objects: [owned("notes")],
    });
    expect(seedersFromModule({ default: users, notes })).toEqual([
      users,
      notes,
    ]);
    expect(() => readSeederFile("helpers.ts", { value: 1 })).toThrow(
      "helpers.ts must export defineSeeder(...)",
    );
  });
});

function owned(prefix: string) {
  const at = new Date("2026-01-15T00:00:00.000Z");
  return {
    _id: createTypeId(prefix),
    _object: "v1.notes",
    _tenant: "tenant_1",
    _archived: false as const,
    _createdAt: at,
    _updatedAt: at,
    name: prefix,
  };
}
