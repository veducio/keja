import { describe, expect, it } from "vitest";
import { buildListSql, encodeCursor } from "./query.ts";
import type { DomainColumn } from "./sql.ts";

const columns: DomainColumn[] = [
  { name: "name", type: "text", nullable: false },
  { name: "email", type: "text", nullable: false },
  { name: "active", type: "boolean", nullable: false },
];

describe("buildListSql", () => {
  it("filters live rows for a tenant and searches text columns", () => {
    const built = buildListSql({
      table: "users",
      columns,
      tenant: "tenant_1",
      query: { q: "ada_%", name: "Ada", limit: 2 },
    });
    expect(built.limit).toBe(2);
    expect(built.text).toContain(`"name" = $3`);
    expect(built.text).toContain(`ilike $4 escape '\\'`);
    expect(built.text).toContain(`order by "_id" asc`);
    expect(built.text).toContain("limit $6");
    expect(built.values.slice(0, 5)).toEqual([
      "tenant_1",
      false,
      "Ada",
      "%ada\\_\\%%",
      "%ada\\_\\%%",
    ]);
  });

  it("pages with a cursor for a descending domain sort", () => {
    const cursor = encodeCursor({
      column: "name",
      direction: "desc",
      value: "Ada",
      id: "users_a",
    });
    const built = buildListSql({
      table: "users",
      columns,
      tenant: "tenant_1",
      query: { sort: "-name", cursor, archived: "true" },
    });
    expect(built.values[1]).toBe(true);
    expect(built.text).toContain(`"name" < $3`);
    expect(built.text).toContain(`"_id" < $4`);
    expect(built.text).toContain(`order by "name" desc, "_id" desc`);
  });

  it("applies a default limit, an allowlist, and extra where checks", () => {
    const built = buildListSql({
      table: "users",
      columns,
      tenant: "tenant_1",
      query: { name: "Ada", email: "skip@example.com" },
      filters: ["name"],
      limitDefault: 20,
      where: { email: "ada@example.com", active: null },
    });
    expect(built.limit).toBe(20);
    expect(built.text).toContain(`"email" = $3`);
    expect(built.text).toContain(`"active" is null`);
    expect(built.text).toContain(`"name" = $4`);
    expect(built.text).not.toContain(`"email" = $4`);
    expect(built.values.slice(2, 4)).toEqual(["ada@example.com", "Ada"]);
  });

  it("includes archived rows when asked", () => {
    const built = buildListSql({
      table: "users",
      columns,
      tenant: "tenant_1",
      query: { archived: "true" },
      includeArchived: true,
    });
    expect(built.text).not.toContain(`"_archived" =`);
    expect(built.values[0]).toBe("tenant_1");
    expect(built.values).not.toContain(true);
  });

  it("rejects a cursor for a different sort", () => {
    const cursor = encodeCursor({
      column: "name",
      direction: "asc",
      value: "Ada",
      id: "users_a",
    });
    expect(() =>
      buildListSql({
        table: "users",
        columns,
        tenant: "tenant_1",
        query: { cursor },
      }),
    ).toThrow("invalid cursor");
  });
});
