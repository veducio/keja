import { DependencyNotMet } from "../errors/framework-errors.ts";
import { processValue } from "../process/slot.ts";
import type { GrantsConfig } from "../project/config.ts";
import { VaultError, vaultSecret } from "../vault/client.ts";

export type ActiveGrants =
  | {
      mode: "transit";
      max_exp: number;
      transit_key: string;
      transit_mount: string;
    }
  | {
      mode: "secret";
      max_exp: number;
      secret: string;
    };

const state = processValue("grants", () => ({
  active: null as ActiveGrants | null,
}));

export function setGrants(settings: ActiveGrants | null) {
  state.active = settings;
}

export function requireGrants(feature: string) {
  if (!state.active) {
    throw new DependencyNotMet(feature, "grants");
  }
  return state.active;
}

export async function connectGrants(config: GrantsConfig) {
  if (!config.enabled) {
    setGrants(null);
    return;
  }
  if (config.mode === "transit") {
    setGrants({
      mode: "transit",
      max_exp: config.max_exp,
      transit_key: config.transit_key,
      transit_mount: config.transit_mount,
    });
    return;
  }
  let secret = config.secret;
  if (config.secret_vault) {
    const data = await vaultSecret(config.secret_vault);
    const value = data[config.secret_field];
    if (typeof value !== "string" || value.trim() === "") {
      throw new VaultError(
        `Vault secret ${config.secret_vault} field ${config.secret_field} is required`,
      );
    }
    secret = value.trim();
  }
  if (typeof secret !== "string" || secret.trim() === "") {
    throw new VaultError("grant secret is required");
  }
  setGrants({
    mode: "secret",
    max_exp: config.max_exp,
    secret: secret.trim(),
  });
}
