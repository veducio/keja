import {
  createRemoteJWKSet,
  type JWTPayload,
  type JWTVerifyGetKey,
  jwtVerify,
} from "jose";
import { frameworkError, projectError } from "../errors/framework-errors.ts";
import { defineMiddleware } from "../route/middleware.ts";

const assertionHeader = "Cf-Access-Jwt-Assertion";
const authorizationCookie = "CF_Authorization";

export type AccessIdentity = {
  sub: string;
  iss: string;
  aud: string[];
  exp: number;
  iat: number;
  email?: string;
  country?: string;
  type?: string;
};

export type CloudflareAccessOptions = {
  team?: string;
  audience?: string | string[];
  getKey?: JWTVerifyGetKey;
};

const jwksByIssuer = new Map<string, JWTVerifyGetKey>();

export function cloudflareAccess(options: CloudflareAccessOptions = {}) {
  const settings = accessSettings(options);
  return defineMiddleware(async ({ request, next }) => {
    const token = accessToken(request);
    if (!token) {
      return denied();
    }
    try {
      const access = await verifyAccessJwt(token, settings);
      return next({ access });
    } catch {
      return denied();
    }
  });
}

export async function verifyAccessJwt(
  token: string,
  options: {
    team: string;
    audience: string | string[];
    getKey?: JWTVerifyGetKey;
  },
) {
  const issuer = teamIssuer(options.team);
  const audience = audienceList(options.audience);
  try {
    const verified = await jwtVerify(token, options.getKey ?? jwks(issuer), {
      issuer,
      audience,
    });
    return accessIdentity(verified.payload);
  } catch (error) {
    if (error instanceof Error && error.message === rejected) {
      throw error;
    }
    throw new Error(rejected);
  }
}

export function accessToken(request: Request) {
  const header = request.headers.get(assertionHeader)?.trim();
  if (header) {
    return header;
  }
  return cookie(request, authorizationCookie);
}

function accessSettings(options: CloudflareAccessOptions) {
  const team = options.team?.trim() || envValue("CF_ACCESS_TEAM_DOMAIN");
  const audience = options.audience ?? envValue("CF_ACCESS_AUD");
  const missing = [
    team ? null : "CF_ACCESS_TEAM_DOMAIN",
    audience ? null : "CF_ACCESS_AUD",
  ].filter((item) => item !== null);
  if (missing.length > 0 || !team || !audience) {
    throw projectError("accessConfig", `Missing ${missing.join(" and ")}`);
  }
  return { team, audience, getKey: options.getKey };
}

function accessIdentity(payload: JWTPayload): AccessIdentity {
  const aud = payload.aud;
  const audiences =
    typeof aud === "string"
      ? [aud]
      : Array.isArray(aud)
        ? aud.filter((item): item is string => typeof item === "string")
        : [];
  if (
    typeof payload.sub !== "string" ||
    typeof payload.iss !== "string" ||
    typeof payload.exp !== "number" ||
    typeof payload.iat !== "number" ||
    audiences.length === 0
  ) {
    throw new Error(rejected);
  }
  return {
    sub: payload.sub,
    iss: payload.iss,
    aud: audiences,
    exp: payload.exp,
    iat: payload.iat,
    ...(typeof payload.email === "string" ? { email: payload.email } : {}),
    ...(typeof payload.country === "string"
      ? { country: payload.country }
      : {}),
    ...(typeof payload.type === "string" ? { type: payload.type } : {}),
  };
}

function teamIssuer(team: string) {
  const trimmed = team.trim().replace(/\/+$/, "");
  if (trimmed.startsWith("https://")) {
    const url = new URL(trimmed);
    if (url.origin !== trimmed) {
      throw projectError(
        "accessConfig",
        "Cloudflare Access team must be a hostname or https origin",
      );
    }
    return url.origin;
  }
  if (!/^[A-Za-z0-9.-]+$/.test(trimmed)) {
    throw projectError(
      "accessConfig",
      "Cloudflare Access team must be a hostname or https origin",
    );
  }
  return `https://${trimmed}`;
}

function audienceList(audience: string | string[]) {
  const values = (Array.isArray(audience) ? audience : audience.split(","))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (values.length === 0) {
    throw projectError("accessConfig", "Missing CF_ACCESS_AUD");
  }
  return values;
}

function jwks(issuer: string) {
  const existing = jwksByIssuer.get(issuer);
  if (existing) {
    return existing;
  }
  const created = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  jwksByIssuer.set(issuer, created);
  return created;
}

function cookie(request: Request, name: string) {
  const header = request.headers.get("cookie");
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      const value = rest.join("=").trim();
      return value ? decodeURIComponent(value) : null;
    }
  }
  return null;
}

function envValue(name: string) {
  const runtime = globalThis as {
    Bun?: { env?: Record<string, string | undefined> };
  };
  const value = runtime.Bun?.env?.[name] ?? process.env[name];
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function denied() {
  return Response.json(frameworkError("accessDenied"), { status: 401 });
}

const rejected = "Cloudflare Access token was rejected";
