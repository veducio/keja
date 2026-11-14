import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadMigrations } from "../db/migrate.ts";
import { projectError } from "../errors/framework-errors.ts";
import { loadConfig } from "../project/config.ts";
import {
  isRepositories,
  type ResolvedList,
  repositoryFlags,
} from "./define.ts";
import { readTables, type TableSchema } from "./sql.ts";

export const repositoryModule = path.join("src", "db", "repositories.ts");

export function renderRepositories(
  tables: readonly TableSchema[],
  flags: ReadonlyMap<string, { list: ResolvedList; get: boolean }>,
) {
  const blocks = [...tables]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((table) => renderRepository(table, flags.get(table.name)));
  return `import { repository } from "@veducio/keja";\n\n${blocks.join("\n\n")}\n`;
}

export async function generateRepositories(root: string) {
  const project = await loadConfig(root);
  const directory = project.database.enabled
    ? project.database.migrations
    : path.resolve(root, "migrations");
  const tables = readTables(
    (await loadMigrations(directory)).map((file) => ({
      file: file.file,
      sql: file.sql,
    })),
  );
  const flags = await loadRepositoryFlags(root);
  for (const [name, flag] of flags) {
    const table = tables.find((item) => item.name === name);
    if (!table) {
      throw projectError("invalidRepositoryFile", `${name} is not a table`);
    }
    if (typeof flag.list === "object") {
      for (const filter of flag.list.filters ?? []) {
        const column = table.columns.find((item) => item.name === filter);
        if (!column || column.type === "jsonb") {
          throw projectError(
            "invalidRepositoryFile",
            `${name}.list.filters ${filter} is not a filter`,
          );
        }
      }
    }
  }
  const source = renderRepositories(tables, flags);
  const output = path.join(root, repositoryModule);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, source);
  return { output, tables: tables.map((table) => table.name) };
}

async function loadRepositoryFlags(root: string) {
  const file = path.join(root, "keja.repositories.ts");
  if (!existsSync(file)) {
    return new Map<string, { list: boolean; get: boolean }>();
  }
  const loaded = (await import(pathToFileURL(file).href)) as {
    default?: unknown;
  };
  if (!isRepositories(loaded.default)) {
    throw projectError(
      "invalidRepositoryFile",
      `${file} must default-export defineRepositories(...)`,
    );
  }
  return repositoryFlags(loaded.default);
}

function renderRepository(
  table: TableSchema,
  flags: { list: ResolvedList; get: boolean } | undefined,
) {
  const columns = table.columns
    .map((column) => renderColumn(column))
    .join("\n");
  const options = [
    renderList(flags?.list),
    flags?.get ? "  get: true," : "",
  ].filter((line) => line !== "");
  const optionBlock = options.length > 0 ? `\n${options.join("\n")}` : "";
  return `export const ${table.name} = repository({
  table: "${table.name}",
  columns: {
${columns}
  } as const,${optionBlock}
});`;
}

function renderList(list: ResolvedList | undefined) {
  if (!list) {
    return "";
  }
  if (list === true) {
    return "  list: true,";
  }
  const parts = [
    list.filters
      ? `filters: [${list.filters.map((name) => `"${name}"`).join(", ")}]`
      : "",
    list.limit !== undefined ? `limit: ${list.limit}` : "",
  ].filter((part) => part !== "");
  return `  list: { ${parts.join(", ")} },`;
}

function renderColumn(column: TableSchema["columns"][number]) {
  if (column.type === "enum") {
    const values = column.values
      .map((value) => JSON.stringify(value))
      .join(", ");
    return `    ${column.name}: { type: "enum", values: [${values}], nullable: ${column.nullable} },`;
  }
  return `    ${column.name}: { type: "${column.type}", nullable: ${column.nullable} },`;
}
