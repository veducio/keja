import type { ArgusConfig } from "../project/config.ts";
import type { ServiceIdentity } from "../server/identity.ts";

export const argusTtlSeconds = 30;

export type ArgusRegistration = {
  instance_id: string;
  service: string;
  env: string;
  base_url: string;
  weight: number;
  status: "healthy";
  version?: string;
  ttl_seconds: number;
  metadata: {
    surface: "public" | "service";
    public: string[];
    service: string[];
  };
};

export function argusRegistrations(input: {
  identity: ServiceIdentity;
  argus: ArgusConfig;
  version?: string;
}) {
  const publicService = input.argus.public ?? input.identity.name;
  const serviceService =
    input.argus.service ?? `${input.identity.name}-service`;
  return [
    ...registrations(publicService, "public", input.identity.public, input),
    ...registrations(serviceService, "service", input.identity.service, input),
  ];
}

export type ArgusFetch = (
  url: string,
  init?: { method?: string; headers?: Headers; body?: string },
) => Promise<Response>;

export async function publishArgus(options: {
  url: string;
  username: string | null;
  password: string | null;
  registrations: readonly ArgusRegistration[];
  fetchImpl?: ArgusFetch;
}) {
  return sendArgus(options, "/v1/register", (registration) => registration);
}

export async function withdrawArgus(options: {
  url: string;
  username: string | null;
  password: string | null;
  registrations: readonly ArgusRegistration[];
  fetchImpl?: ArgusFetch;
}) {
  return sendArgus(options, "/v1/deregister", (registration) => ({
    instance_id: registration.instance_id,
    service: registration.service,
    env: registration.env,
  }));
}

function registrations(
  service: string,
  surface: "public" | "service",
  urls: readonly string[],
  input: {
    identity: ServiceIdentity;
    argus: ArgusConfig;
    version?: string;
  },
): ArgusRegistration[] {
  return urls.map((baseUrl) => ({
    instance_id: instanceId(service, baseUrl),
    service,
    env: input.argus.env,
    base_url: baseUrl,
    weight: 100,
    status: "healthy",
    ...(input.version ? { version: input.version } : {}),
    ttl_seconds: argusTtlSeconds,
    metadata: {
      surface,
      public: input.identity.public,
      service: input.identity.service,
    },
  }));
}

function instanceId(service: string, baseUrl: string) {
  const host = new URL(baseUrl).host
    .replaceAll(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${service}-${host}`;
}

async function sendArgus(
  options: {
    url: string;
    username: string | null;
    password: string | null;
    registrations: readonly ArgusRegistration[];
    fetchImpl?: ArgusFetch;
  },
  pathname: string,
  body: (registration: ArgusRegistration) => unknown,
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const errors: string[] = [];
  for (const registration of options.registrations) {
    try {
      const response = await fetchImpl(joinUrl(options.url, pathname), {
        method: "POST",
        headers: argusHeaders(options.username, options.password),
        body: JSON.stringify(body(registration)),
      });
      if (!response.ok) {
        errors.push(
          `${registration.service} ${registration.base_url} ${response.status}`,
        );
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "request failed";
      errors.push(`${registration.service} ${registration.base_url} ${detail}`);
    }
  }
  return errors;
}

export function argusHeaders(username: string | null, password: string | null) {
  const headers = new Headers({ "content-type": "application/json" });
  if (username !== null && password !== null) {
    headers.set(
      "authorization",
      `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
    );
  }
  return headers;
}

export function joinUrl(url: string, pathname: string) {
  return `${url.replace(/\/+$/, "")}${pathname}`;
}
