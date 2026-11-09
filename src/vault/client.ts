import { DependencyNotMet, projectError } from "../errors/framework-errors.ts";
import { processValue } from "../process/slot.ts";
import type { VaultSettings } from "../project/config.ts";

const state = processValue("vault", () => ({
  active: null as VaultSettings | null,
  fetch: undefined as VaultClientOptions["fetch"] | undefined,
}));

export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultError";
  }
}

export type VaultClientOptions = {
  address?: string;
  token?: string;
  namespace?: string;
  mount?: string;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
};

export function setVault(settings: VaultSettings | null) {
  state.active = settings;
  state.fetch = undefined;
}

export async function connectVault(
  settings: VaultSettings,
  fetchImpl?: VaultClientOptions["fetch"],
) {
  const fetch = fetchImpl ?? globalThis.fetch;
  let response: Response;
  try {
    response = await fetch(`${settings.address}/v1/auth/token/lookup-self`, {
      headers: vaultHeaders(settings.token, settings.namespace),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "request failed";
    throw projectError("vaultInit", detail);
  }
  if (!response.ok) {
    throw projectError(
      "vaultInit",
      (await vaultFailure(response, "auth/token/lookup-self")).message,
    );
  }
  setVault(settings);
  state.fetch = fetchImpl;
}

export function createVault(options: VaultClientOptions = {}) {
  const address = vaultAddress(options.address ?? envValue("VAULT_ADDR"));
  const token = required(
    options.token ?? envValue("VAULT_TOKEN"),
    "VAULT_TOKEN",
  );
  const namespace = options.namespace ?? envValue("VAULT_NAMESPACE");
  const mount = secretMount(
    options.mount ?? envValue("VAULT_KV_MOUNT") ?? "secret",
  );
  const fetchImpl = options.fetch ?? fetch;
  const headers = () => vaultHeaders(token, namespace);
  return {
    async secret<
      Data extends Record<string, unknown> = Record<string, unknown>,
    >(path: string) {
      const secretPath = normalizePath(path);
      const response = await fetchImpl(
        `${address}/v1/${mount}/data/${secretPath}`,
        {
          headers: headers(),
        },
      );
      if (!response.ok) {
        throw await vaultFailure(response, `${mount}/${secretPath}`);
      }
      const body = (await response.json()) as {
        data?: { data?: Data };
      };
      if (!body.data?.data || typeof body.data.data !== "object") {
        throw new VaultError(`Vault secret ${mount}/${secretPath} has no data`);
      }
      return body.data.data;
    },
    transitKey(mountName: string, key: string) {
      const transit = secretMount(mountName);
      const name = secretMount(key);
      return vaultSend<{ type?: unknown; latest_version?: unknown }>(
        fetchImpl,
        `${address}/v1/${transit}/keys/${name}`,
        { headers: headers() },
        `${transit}/keys/${name}`,
      );
    },
    transitSign(mountName: string, key: string, body: TransitSignBody) {
      const transit = secretMount(mountName);
      const name = secretMount(key);
      return vaultSend<{ signature?: unknown }>(
        fetchImpl,
        `${address}/v1/${transit}/sign/${name}`,
        {
          method: "POST",
          headers: jsonHeaders(headers()),
          body: JSON.stringify(body),
        },
        `${transit}/sign/${name}`,
      );
    },
    transitVerify(mountName: string, key: string, body: TransitVerifyBody) {
      const transit = secretMount(mountName);
      const name = secretMount(key);
      return vaultSend<{ valid?: unknown }>(
        fetchImpl,
        `${address}/v1/${transit}/verify/${name}`,
        {
          method: "POST",
          headers: jsonHeaders(headers()),
          body: JSON.stringify(body),
        },
        `${transit}/verify/${name}`,
      );
    },
  };
}

export function openVault(feature: string) {
  const settings = requireVaultSettings(feature);
  return createVault({
    address: settings.address,
    token: settings.token,
    namespace: settings.namespace ?? undefined,
    mount: settings.mount,
    fetch: state.fetch,
  });
}

export function requireVaultSettings(feature: string) {
  if (!state.active) {
    throw new DependencyNotMet(feature, "vault");
  }
  return state.active;
}

type TransitSignBody = {
  input: string;
  hash_algorithm?: string;
  marshaling_algorithm?: string;
  signature_algorithm?: string;
};

type TransitVerifyBody = TransitSignBody & {
  signature: string;
};

export function vaultSecret<
  Data extends Record<string, unknown> = Record<string, unknown>,
>(path: string, options?: VaultClientOptions) {
  if (!options) {
    if (!state.active) {
      throw new DependencyNotMet("vaultSecret", "vault");
    }
    return createVault({
      address: state.active.address,
      token: state.active.token,
      namespace: state.active.namespace ?? undefined,
      mount: state.active.mount,
      fetch: state.fetch,
    }).secret<Data>(path);
  }
  return createVault(options).secret<Data>(path);
}

function vaultAddress(value: string | null) {
  if (!value) {
    throw new VaultError("VAULT_ADDR is required");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new VaultError("VAULT_ADDR must be an absolute http or https URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new VaultError("VAULT_ADDR must be an absolute http or https URL");
  }
  return url.href.replace(/\/$/, "");
}

function secretMount(value: string) {
  const mount = value.trim().replace(/^\/+|\/+$/g, "");
  if (!/^[A-Za-z0-9_-]+$/.test(mount)) {
    throw new VaultError(`invalid Vault mount: ${value}`);
  }
  return mount;
}

function normalizePath(path: string) {
  const cleaned = path.trim().replace(/^\/+|\/+$/g, "");
  const parts = cleaned.split("/");
  if (
    !cleaned ||
    parts.some((part) => part.length === 0 || part === "." || part === "..")
  ) {
    throw new VaultError(`invalid Vault secret path: ${path}`);
  }
  return parts.map((part) => encodeURIComponent(part)).join("/");
}

async function vaultSend<Data>(
  fetchImpl: VaultClientOptions["fetch"],
  url: string,
  init: RequestInit,
  path: string,
) {
  const fetch = fetchImpl ?? globalThis.fetch;
  const response = await fetch(url, init);
  if (!response.ok) {
    throw await vaultFailure(response, path);
  }
  const body = (await response.json()) as { data?: Data };
  if (!body.data || typeof body.data !== "object") {
    throw new VaultError(`Vault ${path} has no data`);
  }
  return body.data;
}

function jsonHeaders(headers: Headers) {
  headers.set("Content-Type", "application/json");
  return headers;
}

function vaultHeaders(token: string, namespace: string | null) {
  const headers = new Headers({ "X-Vault-Token": token });
  if (namespace) {
    headers.set("X-Vault-Namespace", namespace);
  }
  return headers;
}

async function vaultFailure(response: Response, path: string) {
  const errors = await vaultErrors(response);
  if (response.status === 404) {
    return new VaultError(`Vault secret ${path} was not found`);
  }
  const detail = errors.length > 0 ? `: ${errors.join(", ")}` : "";
  return new VaultError(
    `Vault rejected ${path} with status ${response.status}${detail}`,
  );
}

async function vaultErrors(response: Response) {
  try {
    const body = (await response.json()) as { errors?: unknown };
    if (!Array.isArray(body.errors)) {
      return [];
    }
    return body.errors.filter(
      (item): item is string => typeof item === "string",
    );
  } catch {
    return [];
  }
}

function required(value: string | null, name: string) {
  if (!value) {
    throw new VaultError(`${name} is required`);
  }
  return value;
}

function envValue(name: string) {
  const runtime = globalThis as {
    Bun?: { env?: Record<string, string | undefined> };
  };
  const value = runtime.Bun?.env?.[name] ?? process.env[name];
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
