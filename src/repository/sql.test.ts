import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readTables } from "./sql.ts";

const owned = `
  _id text primary key check (keja_is_typeid(_id)),
  _object text not null check (keja_is_object_type(_object)),
  _tenant text not null check (keja_is_tenant(_tenant)),
  _archived boolean not null default false,
  "_createdAt" timestamptz not null,
  "_updatedAt" timestamptz not null,
  check (keja_timestamps("_createdAt", "_updatedAt"))
`;

describe("readTables", () => {
  it("reads domain columns from create table and add column", () => {
    const tables = readTables([
      {
        file: "0001_example.sql",
        sql: `create table users (${owned}, name text not null, email text);`,
      },
      {
        file: "0002_nickname.sql",
        sql: "alter table users add column nickname text;",
      },
    ]);
    expect(tables).toEqual([
      {
        name: "users",
        columns: [
          { name: "name", type: "text", nullable: false },
          { name: "email", type: "text", nullable: true },
          { name: "nickname", type: "text", nullable: true },
        ],
      },
    ]);
  });

  it("reads the example app migrations", () => {
    const file = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../examples/example-app/migrations/0001_example.sql",
    );
    const tables = readTables([
      { file: "0001_example.sql", sql: readFileSync(file, "utf8") },
    ]);
    expect(tables.map((table) => table.name)).toEqual([
      "jobs",
      "posts",
      "users",
    ]);
    expect(tables.find((table) => table.name === "posts")?.columns).toEqual([
      { name: "title", type: "text", nullable: false },
      { name: "author_id", type: "text", nullable: false },
    ]);
  });

  it("rejects a table that misses an owned column or a mapped type", () => {
    expect(() =>
      readTables([
        {
          file: "0001_bad.sql",
          sql: "create table users (_id text not null);",
        },
      ]),
    ).toThrow("users._object must be text not null");
    expect(() =>
      readTables([
        {
          file: "0001_bad.sql",
          sql: `create table users (${owned}, photo bytea);`,
        },
      ]),
    ).toThrow("users.photo has no TypeScript type");
  });
});
