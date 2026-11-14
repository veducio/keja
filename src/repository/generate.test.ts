import { describe, expect, it } from "vitest";
import { renderRepositories } from "./generate.ts";
import { readTables } from "./sql.ts";

const owned = `
  _id text primary key,
  _object text not null,
  _tenant text not null,
  _archived boolean not null,
  "_createdAt" timestamptz not null,
  "_updatedAt" timestamptz not null
`;

describe("renderRepositories", () => {
  it("writes a repository and the processors that are enabled", () => {
    const tables = readTables([
      {
        file: "0001_example.sql",
        sql: `create table users (${owned}, name text not null); create table jobs (${owned}, name text not null);`,
      },
    ]);
    const source = renderRepositories(
      tables,
      new Map([
        ["users", { list: true, get: true }],
        ["jobs", { list: false, get: false }],
      ]),
    );
    expect(source).toContain("export const jobs = repository({");
    expect(source).toContain("list: true,");
    expect(source).toContain("get: true,");
    expect(source.indexOf("export const jobs")).toBeLessThan(
      source.indexOf("export const users"),
    );
    expect(
      source.slice(
        source.indexOf("export const jobs"),
        source.indexOf("export const users"),
      ),
    ).not.toContain("list: true");
  });

  it("writes list filter and limit constraints", () => {
    const tables = readTables([
      {
        file: "0001_example.sql",
        sql: `create table users (${owned}, name text not null, email text not null);`,
      },
    ]);
    const source = renderRepositories(
      tables,
      new Map([
        ["users", { list: { filters: ["name"], limit: 20 }, get: false }],
      ]),
    );
    expect(source).toContain('list: { filters: ["name"], limit: 20 },');
  });

  it("writes enum columns with their values", () => {
    const tables = readTables([
      {
        file: "0001_example.sql",
        sql: `
          create type post_status as enum ('draft', 'published');
          create table posts (${owned}, status post_status not null);
        `,
      },
    ]);
    const source = renderRepositories(tables, new Map());
    expect(source).toContain(
      'status: { type: "enum", values: ["draft", "published"], nullable: false },',
    );
  });
});
