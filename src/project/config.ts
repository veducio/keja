import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { projectError } from "../errors/framework-errors.ts";

const configBrand = "keja.config";

const defaultConfig = {
  versioning: "keja.versioning.ts",
  public: "src/public",
  service: "src/service",
};

export type ArgusConfigInput = {
  url: string;
  env: string;
  username?: string;
  password?: string;
  public?: string;
  service?: string;
};

export type ArgusConfig = {
  url: string;
  env: string;
  username: string | null;
  password: string | null;
  public: string | null;
  service: string | null;
};

export type DatabaseConfigInput =
  | boolean
  | {
      migrations?: string;
    };

export type DatabaseConfig =
  | { enabled: false }
  | { enabled: true; migrations: string };

export type KejaConfigInput = {
  name?: string;
  versioning?: string;
  public?: string;
  service?: string;
  argus?: ArgusConfigInput;
  db?: DatabaseConfigInput;
};

export type KejaConfig = {
  name: string | null;
  versioning: string;
  public: string;
  service: string;
  argus: ArgusConfig | null;
  database: DatabaseConfig;
};

export function defineConfig(input: KejaConfigInput = {}) {
  const config: KejaConfig = {
    name: optionalText(input.name, "name", "service name"),
    versioning: configPath(
      input.versioning,
      defaultConfig.versioning,
      "versioning",
    ),
    public: configPath(input.public, defaultConfig.public, "public"),
    service: configPath(input.service, defaultConfig.service, "service"),
    argus: configArgus(input.argus),
    database: configDatabase(input.db),
  };
  return Object.assign(config, { [configBrand]: true as const });
}

export function isConfig(value: unknown): value is KejaConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    configBrand in value &&
    (value as Record<string, unknown>)[configBrand] === true &&
    hasPath(value, "versioning") &&
    hasPath(value, "public") &&
    hasPath(value, "service") &&
    hasName(value) &&
    hasArgus(value) &&
    hasDatabase(value)
  );
}

export type ProjectPaths = {
  config: string | null;
  versioning: string;
  public: string;
  service: string;
};

export type LoadedConfig = ProjectPaths & {
  name: string | null;
  argus: ArgusConfig | null;
  database: DatabaseConfig;
};

export function resolveProjectPaths(root: string, config: KejaConfig) {
  return {
    versioning: path.resolve(root, config.versioning),
    public: path.resolve(root, config.public),
    service: path.resolve(root, config.service),
  };
}

export async function loadConfig(root: string): Promise<LoadedConfig> {
  const file = path.join(root, "keja.config.ts");
  if (!existsSync(file)) {
    return loadedConfig(root, null, defineConfig());
  }
  const loaded = await import(pathToFileURL(file).href);
  if (!isConfig(loaded.default)) {
    throw projectError(
      "invalidConfigFile",
      `${file} must default-export defineConfig(...)`,
    );
  }
  return loadedConfig(root, file, loaded.default);
}

function configPath(value: unknown, fallback: string, field: string) {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw projectError(
      "invalidConfigFile",
      `keja.config.ts ${field} must be a non-empty path`,
    );
  }
  return value.trim();
}

function loadedConfig(
  root: string,
  file: string | null,
  config: KejaConfig,
): LoadedConfig {
  return {
    config: file,
    ...resolveProjectPaths(root, config),
    name: config.name,
    argus: config.argus,
    database: resolvedDatabase(root, config.database),
  };
}

function resolvedDatabase(
  root: string,
  database: DatabaseConfig,
): DatabaseConfig {
  if (!database.enabled) {
    return database;
  }
  return {
    enabled: true,
    migrations: path.resolve(root, database.migrations),
  };
}

function configDatabase(
  value: DatabaseConfigInput | undefined,
): DatabaseConfig {
  if (value === undefined || value === false) {
    return { enabled: false };
  }
  if (value === true) {
    return { enabled: true, migrations: "migrations" };
  }
  if (typeof value !== "object" || value === null) {
    throw projectError(
      "invalidConfigFile",
      "keja.config.ts db must be false or a database config",
    );
  }
  return {
    enabled: true,
    migrations: configPath(value.migrations, "migrations", "db.migrations"),
  };
}

function configArgus(value: ArgusConfigInput | undefined): ArgusConfig | null {
  if (value === undefined) {
    return null;
  }
  const username = optionalText(value.username, "argus.username", "username");
  const password = optionalText(value.password, "argus.password", "password");
  if ((username === null) !== (password === null)) {
    throw projectError(
      "invalidConfigFile",
      "keja.config.ts argus.username and argus.password must both be set",
    );
  }
  return {
    url: absoluteUrl(value.url),
    env: requiredText(value.env, "argus.env", "environment name"),
    username,
    password,
    public: optionalText(value.public, "argus.public", "service name"),
    service: optionalText(value.service, "argus.service", "service name"),
  };
}

function absoluteUrl(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    throw projectError(
      "invalidConfigFile",
      "keja.config.ts argus.url must be an absolute http or https URL",
    );
  }
  try {
    const url = new URL(value.trim());
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.href.replace(/\/$/, "");
    }
  } catch {
    throw projectError(
      "invalidConfigFile",
      "keja.config.ts argus.url must be an absolute http or https URL",
    );
  }
  throw projectError(
    "invalidConfigFile",
    "keja.config.ts argus.url must be an absolute http or https URL",
  );
}

function requiredText(value: unknown, field: string, label: string) {
  const text = optionalText(value, field, label);
  if (text === null) {
    throw projectError(
      "invalidConfigFile",
      `keja.config.ts ${field} must be a non-empty ${label}`,
    );
  }
  return text;
}

function optionalText(value: unknown, field: string, label: string) {
  if (value === undefined) {
    return null;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw projectError(
      "invalidConfigFile",
      `keja.config.ts ${field} must be a non-empty ${label}`,
    );
  }
  return value.trim();
}

function hasName(value: object) {
  const name = (value as KejaConfig).name;
  return name === null || typeof name === "string";
}

function hasArgus(value: object) {
  const argus = (value as KejaConfig).argus;
  return (
    argus === null ||
    (typeof argus === "object" &&
      typeof argus.url === "string" &&
      typeof argus.env === "string")
  );
}

function hasDatabase(value: object) {
  const database = (value as KejaConfig).database;
  return (
    typeof database === "object" &&
    database !== null &&
    (database.enabled === false ||
      (database.enabled === true && typeof database.migrations === "string"))
  );
}

function hasPath(value: object, key: keyof KejaConfig) {
  return typeof (value as KejaConfig)[key] === "string";
}
