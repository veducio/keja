import { describe, expect, it } from "vitest";
import { setDatabase } from "../db/client.ts";
import { createTypeId } from "../typeid/id.ts";
import { applySeeder } from "./apply.ts";
import { defineSeeder } from "./define.ts";

describe("applySeeder", () => {
  it("inserts owned rows and skips an existing _id", async () => {
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
      expect(statement).toContain("on conflict (_id) do nothing");
      expect(statement).toContain("returning _id");
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
