import { describe, expect, it } from "vitest";
import { setDatabase } from "../db/client.ts";
import { createTypeId } from "../typeid/id.ts";
import { applySeeder, applySeeders, truncateSeedTables } from "./apply.ts";
import { defineSeeder } from "./define.ts";

describe("applySeeder", () => {
  it("inserts owned rows after a clear", async () => {
    const calls: unknown[][] = [];
    setDatabase(((...args: unknown[]) => {
      calls.push(args);
      const first = args[0];
      if (typeof first === "string") {
        return new Identifier(first);
      }
      if (isTemplate(first)) {
        return [{ _id: "kept" }];
      }
      return new InsertHelper(Array.isArray(first) ? first : [first]);
    }) as never);
    try {
      const at = new Date("2026-01-15T00:00:00.000Z");
      const inserted = await applySeeder(
        defineSeeder({
          table: "users",
          objects: [
            {
              _id: createTypeId("users"),
              _object: "v1.users",
              _tenant: "tenant_1",
              _archived: false,
              _createdAt: at,
              _updatedAt: at,
              name: "Ada",
            },
          ],
        }),
      );
      expect(inserted).toBe(1);
      const template = calls.find((args) => isTemplate(args[0]));
      const statement = Array.from(template?.[0] as ArrayLike<string>).join(
        " ",
      );
      expect(statement).toContain("returning _id");
      expect(statement).not.toContain("on conflict");
    } finally {
      setDatabase(null);
    }
  });
});

describe("truncateSeedTables", () => {
  it("truncates each seeded table once", async () => {
    const statements: string[] = [];
    setDatabase({
      unsafe(statement: string) {
        statements.push(statement);
      },
    } as never);
    try {
      await truncateSeedTables(["users", "notes", "users"]);
      expect(statements).toEqual([
        'truncate "users", "notes" restart identity cascade',
      ]);
      await truncateSeedTables([]);
      expect(statements).toHaveLength(1);
    } finally {
      setDatabase(null);
    }
  });
});

describe("applySeeders", () => {
  it("runs truncate and inserts inside one transaction", async () => {
    const statements: string[] = [];
    const inserts: string[] = [];
    let began = false;
    const tx = Object.assign(
      (...args: unknown[]) => {
        const first = args[0];
        if (typeof first === "string") {
          return new Identifier(first);
        }
        if (isTemplate(first)) {
          inserts.push(Array.from(first as ArrayLike<string>).join(" "));
          return [{ _id: "row" }];
        }
        return new InsertHelper(Array.isArray(first) ? first : [first]);
      },
      {
        unsafe(statement: string) {
          statements.push(statement);
        },
      },
    );
    setDatabase({
      begin: async (fn: (sql: unknown) => Promise<unknown>) => {
        began = true;
        return fn(tx);
      },
    } as never);
    try {
      const at = new Date("2026-01-15T00:00:00.000Z");
      const results = await applySeeders([
        defineSeeder({
          table: "users",
          objects: [
            {
              _id: createTypeId("users"),
              _object: "v1.users",
              _tenant: "tenant_1",
              _archived: false,
              _createdAt: at,
              _updatedAt: at,
              name: "Ada",
            },
          ],
        }),
        defineSeeder({
          table: "notes",
          objects: [
            {
              _id: createTypeId("notes"),
              _object: "v1.notes",
              _tenant: "tenant_1",
              _archived: false,
              _createdAt: at,
              _updatedAt: at,
              message: "hi",
            },
          ],
        }),
      ]);
      expect(began).toBe(true);
      expect(statements).toEqual([
        'truncate "users", "notes" restart identity cascade',
      ]);
      expect(inserts).toHaveLength(2);
      expect(results).toEqual([
        { table: "users", inserted: 1 },
        { table: "notes", inserted: 1 },
      ]);
    } finally {
      setDatabase(null);
    }
  });

  it("rolls back when a later seeder fails", async () => {
    let committed = false;
    let inserts = 0;
    const tx = Object.assign(
      (...args: unknown[]) => {
        const first = args[0];
        if (typeof first === "string") {
          return new Identifier(first);
        }
        if (isTemplate(first)) {
          inserts += 1;
          if (inserts > 1) {
            throw new Error("second seeder failed");
          }
          return [{ _id: "row" }];
        }
        return new InsertHelper(Array.isArray(first) ? first : [first]);
      },
      {
        unsafe() {},
      },
    );
    setDatabase({
      begin: async (fn: (sql: unknown) => Promise<unknown>) => {
        try {
          const result = await fn(tx);
          committed = true;
          return result;
        } catch (error) {
          committed = false;
          throw error;
        }
      },
    } as never);
    try {
      const at = new Date("2026-01-15T00:00:00.000Z");
      await expect(
        applySeeders([
          defineSeeder({
            table: "users",
            objects: [
              {
                _id: createTypeId("users"),
                _object: "v1.users",
                _tenant: "tenant_1",
                _archived: false,
                _createdAt: at,
                _updatedAt: at,
                name: "Ada",
              },
            ],
          }),
          defineSeeder({
            table: "notes",
            objects: [
              {
                _id: createTypeId("notes"),
                _object: "v1.notes",
                _tenant: "tenant_1",
                _archived: false,
                _createdAt: at,
                _updatedAt: at,
                message: "hi",
              },
            ],
          }),
        ]),
      ).rejects.toThrow("second seeder failed");
      expect(committed).toBe(false);
    } finally {
      setDatabase(null);
    }
  });
});

class Identifier {
  constructor(readonly name: string) {}
}

class InsertHelper {
  constructor(readonly value: unknown[]) {}
  columns = ["_id"];
}

function isTemplate(value: unknown) {
  return (
    Array.isArray(value) && value.every((part) => typeof part === "string")
  );
}
