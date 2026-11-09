import { describe, expect, it } from "vitest";
import { setDatabase } from "../db/client.ts";
import { createTypeId } from "../typeid/id.ts";
import { repository } from "./runtime.ts";

const columns = {
  name: { type: "text", nullable: false },
  email: { type: "text", nullable: false },
} as const;

describe("repository", () => {
  it("returns the next cursor when another row remains", async () => {
    const calls: { statement: string; values: unknown[] }[] = [];
    setDatabase({
      unsafe(statement: string, values: unknown[]) {
        calls.push({ statement, values });
        return [row("users_a", "Ada"), row("users_b", "Alan")];
      },
    } as never);
    try {
      const users = repository({ table: "users", columns, list: true });
      const page = await users.list({ limit: 1 }, { tenant: "tenant_1" });
      expect(page.items.map((item) => item.name)).toEqual(["Ada"]);
      expect(page.nextCursor).toEqual(expect.any(String));
      expect(calls[0]?.statement).toContain(`"_archived" = $2`);
      expect(calls[0]?.values[1]).toBe(false);
    } finally {
      setDatabase(null);
    }
  });

  it("exposes a row schema with and without meta", () => {
    const users = repository({ table: "users", columns });
    const at = new Date("2026-01-15T00:00:00.000Z");
    expect(
      users.schema.parse({ name: "Ada", email: "ada@example.com" }),
    ).toEqual({
      name: "Ada",
      email: "ada@example.com",
    });
    expect(
      users.meta.parse({
        ...row("users_a", "Ada"),
        _createdAt: at,
        _updatedAt: at,
      })._tenant,
    ).toBe("tenant_1");
  });

  it("keeps query filters to the allowlist and adds where checks", async () => {
    const calls: { statement: string; values: unknown[] }[] = [];
    setDatabase({
      unsafe(statement: string, values: unknown[]) {
        calls.push({ statement, values });
        return [row("users_a", "Ada")];
      },
    } as never);
    try {
      const users = repository({
        table: "users",
        columns,
        list: { filters: ["name"], limit: 10 },
      });
      const parsed = users.list.schema.parse({
        name: "Ada",
        email: "skip@example.com",
      });
      await users.list(parsed, {
        tenant: "tenant_1",
        where: { email: "ada@example.com" },
      });
      expect(calls[0]?.statement).toContain(`"email" = $3`);
      expect(calls[0]?.statement).toContain(`"name" = $4`);
      expect(calls[0]?.values[4]).toBe(11);
    } finally {
      setDatabase(null);
    }
  });

  it("includes archived rows from list and get", async () => {
    const calls: { statement: string; values: unknown[] }[] = [];
    setDatabase({
      unsafe(statement: string, values: unknown[]) {
        calls.push({ statement, values });
        return [row(createTypeId("users"), "Ada")];
      },
    } as never);
    try {
      const users = repository({
        table: "users",
        columns,
        list: true,
        get: true,
      });
      await users.list.includeArchived({}, { tenant: "tenant_1" });
      await users.get.includeArchived(
        { id: "users_a" },
        { archived: "true" },
        { tenant: "tenant_1" },
      );
      expect(calls[0]?.statement).not.toContain(`"_archived" =`);
      expect(calls[1]?.statement).not.toContain(`"_archived" =`);
      expect(calls[1]?.values).toEqual(["users_a", "tenant_1"]);
    } finally {
      setDatabase(null);
    }
  });

  it("archives, deletes, and upserts a row for one tenant", async () => {
    const calls: { statement: string; values: unknown[] }[] = [];
    setDatabase({
      unsafe(statement: string, values: unknown[]) {
        calls.push({ statement, values });
        return statement.startsWith("delete") ? [] : [stored];
      },
    } as never);
    const users = repository({ table: "users", columns });
    const stored = row(createTypeId("users"), "Ada");
    try {
      const archived = await users.archive(stored._id, stored._tenant);
      const removed = await users.hardDelete(stored._id, stored._tenant);
      const saved = await users.upsert(stored);
      expect(archived?._id).toBe(stored._id);
      expect(removed).toBeNull();
      expect(saved?._id).toBe(stored._id);
      expect(calls[0]?.statement).toContain(`"_archived" = $1`);
      expect(calls[0]?.values[0]).toBe(true);
      expect(calls[1]?.statement).toContain(
        `delete from "users" where "_id" = $1 and "_tenant" = $2`,
      );
      expect(calls[2]?.statement).toContain(`"name" = excluded."name"`);
      expect(calls[2]?.statement).toContain(
        `where "users"."_tenant" = excluded."_tenant"`,
      );
      expect(calls[2]?.values[0]).toBe(stored._id);
    } finally {
      setDatabase(null);
    }
  });
});

function row(id: string, name: string) {
  const at = new Date("2026-01-15T00:00:00.000Z");
  return {
    _id: id || createTypeId("users"),
    _object: "v1.users",
    _tenant: "tenant_1",
    _archived: false,
    _createdAt: at,
    _updatedAt: at,
    name,
    email: `${name.toLowerCase()}@example.com`,
  };
}
