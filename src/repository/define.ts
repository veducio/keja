import { projectError } from "../errors/framework-errors.ts";
import { processBrand } from "../process/slot.ts";

const repositoryBrand = processBrand("repositories");
const tableName = /^[a-z_][a-z0-9_]*$/;

export type ListConstraints = {
  filters?: readonly string[];
  limit?: number;
};

export type RepositoryFlags = {
  list?: boolean | ListConstraints;
  get?: boolean;
};

export type ResolvedList = boolean | ListConstraints;

export function defineRepositories<
  const Tables extends Record<string, RepositoryFlags>,
>(tables: Tables) {
  for (const [name, flags] of Object.entries(tables)) {
    if (!tableName.test(name)) {
      throw projectError(
        "invalidRepositoryFile",
        `${name} is not a table name`,
      );
    }
    for (const [key, value] of Object.entries(flags)) {
      if (key === "get") {
        if (typeof value !== "boolean") {
          throw projectError(
            "invalidRepositoryFile",
            `${name}.get is not a repository flag`,
          );
        }
        continue;
      }
      if (key !== "list" || !isListFlag(value)) {
        throw projectError(
          "invalidRepositoryFile",
          `${name}.${key} is not a repository flag`,
        );
      }
      readList(name, value);
    }
  }
  return Object.assign({}, tables, { [repositoryBrand]: true as const });
}

export function isRepositories(
  value: unknown,
): value is Record<string, RepositoryFlags> {
  return (
    typeof value === "object" &&
    value !== null &&
    repositoryBrand in value &&
    (value as Record<symbol, unknown>)[repositoryBrand] === true
  );
}

export function repositoryFlags(value: Record<string, RepositoryFlags>) {
  const flags = new Map<string, { list: ResolvedList; get: boolean }>();
  for (const [name, entry] of Object.entries(value)) {
    if (name === "") {
      continue;
    }
    flags.set(name, {
      list: entry.list === undefined ? false : readList(name, entry.list),
      get: entry.get === true,
    });
  }
  return flags;
}

function isListFlag(value: unknown): value is boolean | ListConstraints {
  return (
    typeof value === "boolean" ||
    (typeof value === "object" && value !== null && !Array.isArray(value))
  );
}

function readList(
  name: string,
  value: boolean | ListConstraints,
): ResolvedList {
  if (typeof value === "boolean") {
    return value;
  }
  for (const key of Object.keys(value)) {
    if (key !== "filters" && key !== "limit") {
      throw projectError(
        "invalidRepositoryFile",
        `${name}.list.${key} is not a list constraint`,
      );
    }
  }
  if (
    value.filters !== undefined &&
    (!Array.isArray(value.filters) ||
      value.filters.some(
        (filter) => typeof filter !== "string" || !tableName.test(filter),
      ))
  ) {
    throw projectError(
      "invalidRepositoryFile",
      `${name}.list.filters must name columns`,
    );
  }
  if (
    value.limit !== undefined &&
    (!Number.isInteger(value.limit) || value.limit < 1 || value.limit > 100)
  ) {
    throw projectError(
      "invalidRepositoryFile",
      `${name}.list.limit must be from 1 to 100`,
    );
  }
  return {
    ...(value.filters ? { filters: [...value.filters] } : {}),
    ...(value.limit !== undefined ? { limit: value.limit } : {}),
  };
}
