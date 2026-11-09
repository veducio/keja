import { DependencyNotMet } from "../errors/framework-errors.ts";
import { processValue } from "../process/slot.ts";
import type { ArgusSettings } from "../project/config.ts";
import { type ArgusFetch, argusHeaders, joinUrl } from "./register.ts";

const state = processValue("argus", () => ({
  active: null as ArgusSettings | null,
}));

export class ServiceCallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceCallError";
  }
}

export function setArgus(config: ArgusSettings | null) {
  state.active = config;
}

export async function callService<Data = unknown>(
  service: string,
  path: string,
  body?: unknown,
  options: {
    fetchImpl?: ArgusFetch;
    random?: () => number;
  } = {},
): Promise<Data> {
  if (!state.active) {
    throw new DependencyNotMet("service call", "argus");
  }
  const serviceName = serviceNameOf(service);
  const requestPath = servicePath(path);
  const fetchImpl = options.fetchImpl ?? fetch;
  const discovery = await fetchImpl(
    `${joinUrl(state.active.url, `/v1/services/${encodeURIComponent(serviceName)}`)}?env=${encodeURIComponent(state.active.env)}`,
    { headers: argusHeaders(state.active.username, state.active.password) },
  );
  if (!discovery.ok) {
    throw await discoveryFailure(discovery, serviceName);
  }
  const listed = (await discovery.json()) as { instances?: unknown };
  const baseUrl = pickInstance(listed.instances, options.random ?? Math.random);
  if (!baseUrl) {
    throw new ServiceCallError(
      `Argus has no healthy instance for ${serviceName}`,
    );
  }
  const response = await fetchImpl(joinUrl(baseUrl, requestPath), {
    method: "POST",
    headers: new Headers({ "content-type": "application/json" }),
    body: JSON.stringify(body ?? {}),
  });
  const payload = await readPayload(response);
  if (!response.ok) {
    const detail = payload === undefined ? "" : `: ${payloadText(payload)}`;
    throw new ServiceCallError(
      `${serviceName} returned ${response.status}${detail}`,
    );
  }
  return payload as Data;
}

function serviceNameOf(service: string) {
  const name = service.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
    throw new ServiceCallError(`invalid service name: ${service}`);
  }
  return name;
}

function servicePath(path: string) {
  const trimmed = path.trim();
  if (trimmed === "" || trimmed.includes("://") || trimmed.startsWith("//")) {
    throw new ServiceCallError(`invalid service path: ${path}`);
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function pickInstance(value: unknown, random: () => number) {
  if (!Array.isArray(value)) {
    return null;
  }
  const healthy = value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const instance = item as {
      base_url?: unknown;
      weight?: unknown;
      status?: unknown;
    };
    if (
      instance.status !== "healthy" ||
      typeof instance.base_url !== "string"
    ) {
      return [];
    }
    const weight =
      typeof instance.weight === "number" && instance.weight > 0
        ? instance.weight
        : 0;
    return [{ baseUrl: instance.base_url, weight }];
  });
  if (healthy.length === 0) {
    return null;
  }
  const total = healthy.reduce((sum, instance) => sum + instance.weight, 0);
  if (total === 0) {
    const index = Math.min(
      healthy.length - 1,
      Math.floor(random() * healthy.length),
    );
    return healthy[index]?.baseUrl ?? null;
  }
  let cursor = random() * total;
  for (const instance of healthy) {
    cursor -= instance.weight;
    if (cursor < 0) {
      return instance.baseUrl;
    }
  }
  return healthy[healthy.length - 1]?.baseUrl ?? null;
}

async function discoveryFailure(response: Response, service: string) {
  const payload = await readPayload(response);
  if (response.status === 404) {
    return new ServiceCallError(`Argus has no service ${service}`);
  }
  const detail = payload === undefined ? "" : `: ${payloadText(payload)}`;
  return new ServiceCallError(
    `Argus rejected ${service} with status ${response.status}${detail}`,
  );
}

async function readPayload(response: Response) {
  const text = await response.text();
  if (text.trim() === "") {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function payloadText(payload: unknown) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return text.length > 200 ? `${text.slice(0, 200)}...` : text;
}
