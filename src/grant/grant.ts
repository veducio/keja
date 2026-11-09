import { decodeJwt, decodeProtectedHeader, type JWTPayload } from "jose";
import {
  openVault,
  requireVaultSettings,
  VaultError,
} from "../vault/client.ts";

export type Grant = {
  subject: string;
  action: string;
  context: Record<string, unknown>;
};

type GrantInput = {
  subject: string;
  action: string;
  exp: number;
  context?: Record<string, unknown>;
};

type KeySpec = {
  alg: string;
  hash?: string;
  marshaling?: string;
  signature?: string;
};

const keySpecs: Record<string, KeySpec> = {
  "rsa-2048": { alg: "RS256", hash: "sha2-256", signature: "pkcs1v15" },
  "rsa-3072": { alg: "RS256", hash: "sha2-256", signature: "pkcs1v15" },
  "rsa-4096": { alg: "RS256", hash: "sha2-256", signature: "pkcs1v15" },
  "ecdsa-p256": { alg: "ES256", hash: "sha2-256", marshaling: "jws" },
  "ecdsa-p384": { alg: "ES384", hash: "sha2-384", marshaling: "jws" },
  "ecdsa-p521": { alg: "ES512", hash: "sha2-512", marshaling: "jws" },
  ed25519: { alg: "EdDSA" },
};

export async function grant(input: GrantInput) {
  const settings = grantSettings("grant");
  const subject = requiredText(input.subject, "subject");
  const action = requiredText(input.action, "action");
  const lifetime = lifetimeSeconds(input.exp, settings.grant_max_exp);
  const context = contextObject(input.context);
  const vault = openVault("grant");
  const key = await readKey(vault, settings);
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(
    JSON.stringify({
      sub: subject,
      action,
      iat: now,
      exp: now + lifetime,
      context,
    }),
  );
  const header = base64url(
    JSON.stringify({ alg: key.alg, typ: "JWT", kid: String(key.version) }),
  );
  const signingInput = `${header}.${body}`;
  const signed = await vault.transitSign(
    settings.transit_mount,
    settings.transit_key,
    signBody(key, base64(signingInput)),
  );
  const signature = vaultSignature(signed.signature);
  if (signature.version !== String(key.version)) {
    throw new VaultError("Vault signed the grant with a different key version");
  }
  return `${signingInput}.${signature.segment}`;
}

export async function verifyGrant(token: string, options: { action: string }) {
  const settings = grantSettings("verifyGrant");
  const action = requiredText(options.action, "action");
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new VaultError("grant token is unreadable");
  }
  const header = decodeProtectedHeader(token);
  const payload = decodeJwt(token);
  const vault = openVault("verifyGrant");
  const key = await readKey(vault, settings);
  if (
    header.alg !== key.alg ||
    typeof header.kid !== "string" ||
    !/^\d+$/.test(header.kid)
  ) {
    throw new VaultError("grant token is unreadable");
  }
  const verified = await vault.transitVerify(
    settings.transit_mount,
    settings.transit_key,
    {
      ...signBody(key, base64(`${parts[0]}.${parts[1]}`)),
      signature: `vault:v${header.kid}:${Buffer.from(parts[2], "base64url").toString("base64")}`,
    },
  );
  if (verified.valid !== true) {
    throw new VaultError("grant signature was rejected");
  }
  return claims(payload, action);
}

function grantSettings(feature: "grant" | "verifyGrant") {
  const settings = requireVaultSettings(feature);
  if (!settings.transit_key) {
    throw new VaultError("vault transit key is required");
  }
  return settings as typeof settings & { transit_key: string };
}

async function readKey(
  vault: ReturnType<typeof openVault>,
  settings: { transit_mount: string; transit_key: string },
) {
  const data = await vault.transitKey(
    settings.transit_mount,
    settings.transit_key,
  );
  if (typeof data.type !== "string" || !(data.type in keySpecs)) {
    throw new VaultError("Vault transit key type cannot sign a grant");
  }
  const version = data.latest_version;
  if (
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    throw new VaultError("Vault transit key has no version");
  }
  return { ...keySpecs[data.type], version };
}

function signBody(
  key: KeySpec,
  input: string,
): {
  input: string;
  hash_algorithm?: string;
  marshaling_algorithm?: string;
  signature_algorithm?: string;
} {
  return {
    input,
    ...(key.hash ? { hash_algorithm: key.hash } : {}),
    ...(key.marshaling ? { marshaling_algorithm: key.marshaling } : {}),
    ...(key.signature ? { signature_algorithm: key.signature } : {}),
  };
}

function vaultSignature(value: unknown) {
  if (typeof value !== "string") {
    throw new VaultError("Vault returned an unreadable signature");
  }
  const match = /^vault:v(\d+):([A-Za-z0-9+/=_-]+)$/.exec(value);
  if (!match) {
    throw new VaultError("Vault returned an unreadable signature");
  }
  return {
    version: match[1],
    segment: Buffer.from(match[2], "base64").toString("base64url"),
  };
}

function claims(payload: JWTPayload, action: string): Grant {
  const now = Math.floor(Date.now() / 1000);
  if (
    typeof payload.exp !== "number" ||
    !Number.isInteger(payload.exp) ||
    payload.exp <= now
  ) {
    throw new VaultError("grant is expired");
  }
  if (
    typeof payload.iat !== "number" ||
    !Number.isInteger(payload.iat) ||
    payload.iat > now ||
    payload.iat >= payload.exp
  ) {
    throw new VaultError("grant token is unreadable");
  }
  if (typeof payload.sub !== "string" || payload.sub.trim() === "") {
    throw new VaultError("grant token is unreadable");
  }
  if (payload.action !== action) {
    throw new VaultError("grant action does not match");
  }
  if (!isContext(payload.context)) {
    throw new VaultError("grant context must be a plain object");
  }
  return {
    subject: payload.sub,
    action,
    context: payload.context,
  };
}

function requiredText(value: unknown, field: string) {
  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    value.trim() !== value
  ) {
    throw new VaultError(`grant ${field} must be a non-empty string`);
  }
  return value;
}

function lifetimeSeconds(value: unknown, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new VaultError("grant exp must be a whole number of seconds");
  }
  if (value > max) {
    throw new VaultError(`grant exp must be at most ${max} seconds`);
  }
  return value;
}

function contextObject(value: unknown) {
  if (value === undefined) {
    return {};
  }
  if (!isContext(value)) {
    throw new VaultError("grant context must be a plain object");
  }
  return value;
}

function isContext(value: unknown): value is Record<string, unknown> {
  if (!isPlain(value)) {
    return false;
  }
  return Object.values(value).every((item) => isJson(item));
}

function isJson(value: unknown): boolean {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((item) => isJson(item));
  }
  if (!isPlain(value)) {
    return false;
  }
  return Object.values(value).every((item) => isJson(item));
}

function isPlain(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function base64url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64(value: string) {
  return Buffer.from(value).toString("base64");
}
