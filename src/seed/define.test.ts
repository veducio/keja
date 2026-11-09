import { describe, expect, it } from "vitest";
import { createTypeId } from "../typeid/id.ts";
import { defineSeeder, isSeeder } from "./define.ts";

const at = new Date("2026-01-15T00:00:00.000Z");

function row(name: string) {
  return {
    _id: createTypeId("users"),
    _object: "v1.users",
    _tenant: "tenant_1",
    _archived: false,
    _createdAt: at,
    _updatedAt: at,
    name,
  };
}

describe("defineSeeder", () => {
  it("keeps a table and its owned objects", () => {
    const seeder = defineSeeder({
      table: "users",
      objects: [row("Ada Lovelace")],
    });
    expect(isSeeder(seeder)).toBe(true);
    expect(seeder.table).toBe("users");
    expect(seeder.objects[0]?.name).toBe("Ada Lovelace");
  });

  it("rejects a table name, an empty list, and a row that is not owned", () => {
    expect(() =>
      defineSeeder({ table: "Users", objects: [row("Ada")] }),
    ).toThrow("Users is not a table name");
    expect(() => defineSeeder({ table: "users", objects: [] })).toThrow(
      "users has no objects",
    );
    expect(() =>
      defineSeeder({
        table: "users",
        objects: [{ name: "Ada" }],
      }),
    ).toThrow("OwnedObjects _id must be a typeid");
    const ada = row("Ada");
    expect(() =>
      defineSeeder({
        table: "users",
        objects: [ada, { ...ada, email: "ada@example.com" }],
      }),
    ).toThrow("users objects must use the same columns");
  });
});
