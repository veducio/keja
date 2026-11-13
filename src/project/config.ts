import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { projectError } from "../errors/framework-errors.ts";
import { freshImportUrl } from "./reload-graph.ts";

const configBrand = "keja.config";

const defaultConfig = {
  versioning: "keja.versioning.ts",
  public_path: "src/public",
  service_path: "src/service",
};

export type ArgusSettings = {
  url: string;
  env: string;
  username: string | null;
  password: string | null;
  public: string | null;
  service: string | null;
};

export type ArgusConfigInput = {
  enabled: boolean;
  url?: string;
  env?: string;
  username?: string;
  password?: string;
  public?: string;
  service?: string;
};

export type ArgusConfig =
  | { enabled: false }
  | ({ enabled: true } & ArgusSettings);

export type DatabaseConfigInput = {
  enabled: boolean;
  migrations?: string;
};

export type DatabaseConfig =
  | { enabled: false }
  | { enabled: true; migrations: string };

export type VaultSettings = {
  address: string;
  token: string;
  namespace: string | null;
  mount: string;
};

export type VaultConfigInput = {
  enabled: boolean;
  address?: string;
  token?: string;
  namespace?: string;
  mount?: string;
};

export type VaultConfig =
  | { enabled: false }
  | ({ enabled: true } & VaultSettings);

export type GrantsConfigInput = {
  enabled: boolean;
  mode?: "transit" | "secret";
  max_exp?: number;
  transit_key?: string;
  transit_mount?: string;
  secret?: string;
  secret_vault?: string;
  secret_field?: string;
};

export type GrantsConfig =
  | { enabled: false }
  | {
      enabled: true;
      mode: "transit";
      max_exp: number;
      transit_key: string;
      transit_mount: string;
    }
  | {
      enabled: true;
      mode: "secret";
      max_exp: number;
      secret: string | null;
      secret_vault: string | null;
      secret_field: string;
    };

export type BatchConfigInput = boolean | { enabled: boolean };

export type BatchConfig = { enabled: boolean };

export type KejaConfigInput = {
  name?: string;
  versioning?: string;
  public_path?: string;
  service_path?: string;
  argus?: ArgusConfigInput;
  db?: DatabaseConfigInput;
  vault?: VaultConfigInput;
  grants?: GrantsConfigInput;
  batch?: BatchConfigInput;
};

export type KejaConfig = {
  name: string | null;
  versioning: string;
  public_path: string;
  service_path: string;
  argus: ArgusConfig;
  database: DatabaseConfig;
  vault: VaultConfig;
  grants: GrantsConfig;
  batch: BatchConfig;
};

export function defineConfig(input: KejaConfigInput = {}) {
  const config: KejaConfig = {
    name: optionalText(input.name, "name", "service name"),
    versioning: configPath(
      input.versioning,
      defaultConfig.versioning,
      "versioning",
    ),
    public_path: configPath(
      input.public_path,
      defaultConfig.public_path,
      "public_path",
    ),
    service_path: configPath(
      input.service_path,
      defaultConfig.service_path,
      "service_path",
    ),
    argus: configArgus(input.argus),
    database: configDatabase(input.db),
    vault: configVault(input.vault),
    grants: configGrants(input.grants),
    batch: configBatch(input.batch),
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
    hasPath(value, "public_path") &&
    hasPath(value, "service_path") &&
    hasName(value) &&
    hasArgus(value) &&
    hasDatabase(value) &&
    hasVault(value) &&
    hasGrants(value) &&
    hasBatch(value)
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
  argus: ArgusConfig;
  database: DatabaseConfig;
  vault: VaultConfig;
  grants: GrantsConfig;
  batch: BatchConfig;
};

export function resolveProjectPaths(root: string, config: KejaConfig) {
  return {
    versioning: path.resolve(root, config.versioning),
    public: path.resolve(root, config.public_path),
    service: path.resolve(root, config.service_path),
  };
}

export async function loadConfig(
  root: string,
  generation?: string,
): Promise<LoadedConfig> {
  const file = path.join(root, "keja.config.ts");
  if (!existsSync(file)) {
    return loadedConfig(root, null, defineConfig());
  }
  const href = generation
    ? freshImportUrl(file, generation)
    : pathToFileURL(file).href;
  const loaded = await import(href);
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
    vault: config.vault,
    grants: config.grants,
    batch: config.batch,
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
  if (value === undefined) {
    return { enabled: false };
  }
  if (!isEnabledObject(value)) {
    throw projectError(
      "invalidConfigFile",
      "keja.config.ts db must be an object with enabled",
    );
  }
  if (!value.enabled) {
    return { enabled: false };
  }
  return {
    enabled: true,
    migrations: configPath(value.migrations, "migrations", "db.migrations"),
  };
}

function configArgus(value: ArgusConfigInput | undefined): ArgusConfig {
  if (value === undefined) {
    return { enabled: false };
  }
  if (!isEnabledObject(value)) {
    throw projectError(
      "invalidConfigFile",
      "keja.config.ts argus must be an object with enabled",
    );
  }
  if (!value.enabled) {
    return { enabled: false };
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
    enabled: true,
    url: absoluteHttpUrl(value.url, "argus.url"),
    env: requiredText(value.env, "argus.env", "environment name"),
    username,
    password,
    public: optionalText(value.public, "argus.public", "service name"),
    service: optionalText(value.service, "argus.service", "service name"),
  };
}

function configVault(value: VaultConfigInput | undefined): VaultConfig {
  if (value === undefined) {
    return { enabled: false };
  }
  if (!isEnabledObject(value)) {
    throw projectError(
      "invalidConfigFile",
      "keja.config.ts vault must be an object with enabled",
    );
  }
  if (!value.enabled) {
    return { enabled: false };
  }
  const namespace =
    value.namespace ?? configEnv("VAULT_NAMESPACE") ?? undefined;
  return {
    enabled: true,
    address: absoluteHttpUrl(
      value.address ?? configEnv("VAULT_ADDR") ?? undefined,
      "vault.address",
    ),
    token: requiredText(
      value.token ?? configEnv("VAULT_TOKEN") ?? undefined,
      "vault.token",
      "token",
    ),
    namespace: optionalText(namespace, "vault.namespace", "namespace"),
    mount: vaultMount(value.mount ?? configEnv("VAULT_KV_MOUNT") ?? "secret"),
  };
}

function configGrants(value: GrantsConfigInput | undefined): GrantsConfig {
  if (value === undefined) {
    return { enabled: false };
  }
  if (!isEnabledObject(value)) {
    throw projectError(
      "invalidConfigFile",
      "keja.config.ts grants must be an object with enabled",
    );
  }
  if (!value.enabled) {
    return { enabled: false };
  }
  const mode = value.mode ?? "transit";
  if (mode !== "transit" && mode !== "secret") {
    throw projectError(
      "invalidConfigFile",
      "keja.config.ts grants.mode must be transit or secret",
    );
  }
  const max_exp = grantMaxExp(value.max_exp);
  if (mode === "transit") {
    return {
      enabled: true,
      mode: "transit",
      max_exp,
      transit_key: vaultName(
        requiredText(value.transit_key, "grants.transit_key", "key name"),
        "grants.transit_key",
      ),
      transit_mount: vaultName(
        value.transit_mount ?? "transit",
        "grants.transit_mount",
      ),
    };
  }
  const secret =
    value.secret === undefined
      ? (configEnv("GRANT_SECRET") ?? null)
      : requiredText(value.secret, "grants.secret", "secret");
  const secret_vault =
    value.secret_vault === undefined
      ? null
      : secretVaultPath(
          requiredText(value.secret_vault, "grants.secret_vault", "path"),
        );
  if (secret === null && secret_vault === null) {
    throw projectError(
      "invalidConfigFile",
      "keja.config.ts grants.secret, GRANT_SECRET, or grants.secret_vault is required",
    );
  }
  return {
    enabled: true,
    mode: "secret",
    max_exp,
    secret,
    secret_vault,
    secret_field: vaultName(
      value.secret_field ?? "secret",
      "grants.secret_field",
    ),
  };
}

function configBatch(value: BatchConfigInput | undefined): BatchConfig {
  if (value === undefined) {
    return { enabled: true };
  }
  if (typeof value === "boolean") {
    return { enabled: value };
  }
  if (!isEnabledObject(value)) {
    throw projectError(
      "invalidConfigFile",
      "keja.config.ts batch must be a boolean or an object with enabled",
    );
  }
  return { enabled: value.enabled };
}

function isEnabledObject(value: unknown): value is { enabled: boolean } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { enabled?: unknown }).enabled === "boolean"
  );
}

function absoluteHttpUrl(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw projectError(
      "invalidConfigFile",
      `keja.config.ts ${field} must be an absolute http or https URL`,
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
      `keja.config.ts ${field} must be an absolute http or https URL`,
    );
  }
  throw projectError(
    "invalidConfigFile",
    `keja.config.ts ${field} must be an absolute http or https URL`,
  );
}

function vaultMount(value: string) {
  return vaultName(value, "vault.mount");
}

function vaultName(value: string, field: string) {
  const name = value.trim().replace(/^\/+|\/+$/g, "");
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    throw projectError(
      "invalidConfigFile",
      `keja.config.ts ${field} must be a name`,
    );
  }
  return name;
}

function secretVaultPath(value: string) {
  const cleaned = value.trim().replace(/^\/+|\/+$/g, "");
  const parts = cleaned.split("/");
  if (
    !cleaned ||
    parts.some((part) => part.length === 0 || part === "." || part === "..")
  ) {
    throw projectError(
      "invalidConfigFile",
      "keja.config.ts grants.secret_vault must be a Vault secret path",
    );
  }
  return cleaned;
}

function grantMaxExp(value: number | undefined) {
  if (value === undefined) {
    return 900;
  }
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 86400
  ) {
    throw projectError(
      "invalidConfigFile",
      "keja.config.ts grants.max_exp must be a whole number of seconds from 1 to 86400",
    );
  }
  return value;
}

function configEnv(name: string) {
  const runtime = globalThis as {
    Bun?: { env?: Record<string, string | undefined> };
  };
  const value = runtime.Bun?.env?.[name] ?? process.env[name];
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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
    typeof argus === "object" &&
    argus !== null &&
    (argus.enabled === false ||
      (argus.enabled === true &&
        typeof argus.url === "string" &&
        typeof argus.env === "string"))
  );
}

function hasVault(value: object) {
  const vault = (value as KejaConfig).vault;
  return (
    typeof vault === "object" &&
    vault !== null &&
    (vault.enabled === false ||
      (vault.enabled === true &&
        typeof vault.address === "string" &&
        typeof vault.token === "string" &&
        typeof vault.mount === "string"))
  );
}

function hasGrants(value: object) {
  const grants = (value as KejaConfig).grants;
  return (
    typeof grants === "object" &&
    grants !== null &&
    (grants.enabled === false ||
      (grants.enabled === true &&
        (grants.mode === "transit" || grants.mode === "secret") &&
        typeof grants.max_exp === "number"))
  );
}

function hasBatch(value: object) {
  const batch = (value as KejaConfig).batch;
  return (
    typeof batch === "object" &&
    batch !== null &&
    typeof batch.enabled === "boolean"
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
