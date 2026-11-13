import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { projectError } from "../errors/framework-errors.ts";
import { isRoute, type RouteDefinition } from "../route/define.ts";
import {
  type MiddlewareDefinition,
  middlewareList,
} from "../route/middleware.ts";
import { isVersions, type VersionDefinition } from "../versioning/define.ts";
import {
  type ArgusConfig,
  type BatchConfig,
  type DatabaseConfig,
  type GrantsConfig,
  loadConfig,
  type ProjectPaths,
  type VaultConfig,
} from "./config.ts";
import { beginProjectReload, freshImportUrl } from "./reload-graph.ts";

export type LoadedProject = {
  paths: ProjectPaths;
  name: string | null;
  argus: ArgusConfig;
  vault: VaultConfig;
  grants: GrantsConfig;
  batch: BatchConfig;
  database: DatabaseConfig;
  versions: VersionDefinition[];
  publicRoutes: RouteDefinition[];
  publicMiddleware: MiddlewareDefinition<object>[];
  serviceRoutes: RouteDefinition[];
  serviceMiddleware: MiddlewareDefinition<object>[];
};

export async function loadProject(
  root: string,
  options?: { generation?: string },
): Promise<LoadedProject> {
  const generation = options?.generation;
  if (generation) {
    beginProjectReload(root, generation);
  }
  const loaded = await loadConfig(root, generation);
  const paths = loaded;
  if (!existsSync(paths.versioning)) {
    throw projectError("missingVersionFile", `Missing ${paths.versioning}`);
  }
  const versioning = await import(projectHref(paths.versioning, generation));
  if (!isVersions(versioning.default)) {
    throw projectError(
      "invalidVersionFile",
      `${paths.versioning} must default-export defineVersions(...)`,
    );
  }
  const publicDirectory = paths.public;
  const serviceDirectory = paths.service;
  return {
    paths,
    name: loaded.name,
    argus: loaded.argus,
    vault: loaded.vault,
    grants: loaded.grants,
    batch: loaded.batch,
    database: loaded.database,
    versions: versioning.default.versions,
    publicRoutes: await loadRoutes(publicDirectory, generation),
    publicMiddleware: await loadServerMiddleware(publicDirectory, generation),
    serviceRoutes: await loadRoutes(serviceDirectory, generation),
    serviceMiddleware: await loadServerMiddleware(serviceDirectory, generation),
  };
}

function projectHref(file: string, generation?: string) {
  return generation
    ? freshImportUrl(file, generation)
    : pathToFileURL(file).href;
}

async function loadRoutes(directory: string, generation?: string) {
  if (!existsSync(directory)) {
    throw projectError("missingRouteDirectory", `Missing ${directory}`);
  }
  const routes: RouteDefinition[] = [];
  for (const file of await collectRouteFiles(directory)) {
    const loaded = await import(
      projectHref(path.join(directory, file), generation)
    );
    const exported = routesFromModule(loaded);
    if (exported.length === 0) {
      throw projectError(
        "invalidRouteFile",
        `${file} must export defineRoute(...)`,
      );
    }
    routes.push(...exported);
  }
  return routes;
}

async function loadServerMiddleware(directory: string, generation?: string) {
  const file = path.join(directory, "_middleware.ts");
  if (!existsSync(file)) {
    return [];
  }
  const loaded = await import(projectHref(file, generation));
  const exported = middlewareList(loaded.default);
  if (!exported) {
    throw projectError(
      "invalidMiddlewareFile",
      `${file} must default-export defineMiddleware(...)`,
    );
  }
  return exported;
}

export function routesFromModule(module: object) {
  const record = module as Record<string, unknown>;
  const names = Object.keys(record).filter((name) => name !== "default");
  const ordered = "default" in record ? ["default", ...names] : names;
  const routes: RouteDefinition[] = [];
  for (const name of ordered) {
    const value = record[name];
    if (isRoute(value)) {
      routes.push(value);
    }
  }
  return routes;
}

export async function collectRouteFiles(directory: string) {
  const files = await walk(directory, "");
  return files.filter(
    (file) =>
      file.endsWith(".ts") &&
      !file.endsWith(".test.ts") &&
      !isServerMiddlewareFile(file),
  );
}

async function walk(directory: string, prefix: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await walk(path.join(directory, entry.name), relative)));
      continue;
    }
    if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files;
}

function isServerMiddlewareFile(file: string) {
  const normalized = file.replaceAll("\\", "/");
  return (
    normalized === "_middleware.ts" || normalized.endsWith("/_middleware.ts")
  );
}
