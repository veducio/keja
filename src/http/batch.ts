import { frameworkError } from "../errors/framework-errors.ts";
import type { RouteDefinition } from "../route/define.ts";
import {
  type MiddlewareDefinition,
  runMiddleware,
} from "../route/middleware.ts";
import {
  isAfterVersion,
  type VersionDefinition,
} from "../versioning/define.ts";

const methods = ["get", "post", "put", "patch", "delete"] as const;
const batchLimit = 25;

type BatchCall = {
  method: (typeof methods)[number];
  path: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: unknown;
};

export async function runBatch(
  request: Request,
  versions: readonly VersionDefinition[],
  routes: readonly RouteDefinition[],
  middleware: readonly MiddlewareDefinition<object>[],
  requested: VersionDefinition,
  token: string,
  postOnly: boolean,
) {
  const calls = await readCalls(request);
  if (!calls.ok) {
    return Response.json(
      frameworkError("invalidRequest", { issues: calls.issues }),
      { status: 400 },
    );
  }
  const results = [];
  for (const call of calls.calls) {
    results.push(
      await runCall(
        request,
        versions,
        routes,
        middleware,
        requested,
        token,
        postOnly,
        call,
      ),
    );
  }
  return Response.json({ results }, { status: 207 });
}

async function readCalls(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false as const,
      issues: [{ message: "Request body must be JSON" }],
    };
  }
  if (!isRecord(body) || !Array.isArray(body.requests)) {
    return {
      ok: false as const,
      issues: [{ message: "requests must be an array" }],
    };
  }
  if (body.requests.length === 0 || body.requests.length > batchLimit) {
    return {
      ok: false as const,
      issues: [{ message: `requests must contain 1 to ${batchLimit} calls` }],
    };
  }
  const calls: BatchCall[] = [];
  for (const item of body.requests) {
    const call = readCall(item);
    if (!call.ok) {
      return call;
    }
    calls.push(call.call);
  }
  return { ok: true as const, calls };
}

function readCall(item: unknown) {
  if (!isRecord(item)) {
    return {
      ok: false as const,
      issues: [{ message: "Each request must be an object" }],
    };
  }
  const method =
    typeof item.method === "string" ? item.method.toLowerCase() : "";
  if (!methods.includes(method as BatchCall["method"])) {
    return {
      ok: false as const,
      issues: [{ message: "method must be get, post, put, patch, or delete" }],
    };
  }
  if (typeof item.path !== "string" || !item.path.startsWith("/")) {
    return {
      ok: false as const,
      issues: [{ message: "path must start with /" }],
    };
  }
  if (item.params !== undefined && !isRecord(item.params)) {
    return {
      ok: false as const,
      issues: [{ message: "params must be an object" }],
    };
  }
  if (item.query !== undefined && !isRecord(item.query)) {
    return {
      ok: false as const,
      issues: [{ message: "query must be an object" }],
    };
  }
  return {
    ok: true as const,
    call: {
      method: method as BatchCall["method"],
      path: item.path,
      params: item.params as Record<string, unknown> | undefined,
      query: item.query as Record<string, unknown> | undefined,
      body: item.body,
    },
  };
}

async function runCall(
  request: Request,
  versions: readonly VersionDefinition[],
  routes: readonly RouteDefinition[],
  middleware: readonly MiddlewareDefinition<object>[],
  requested: VersionDefinition,
  token: string,
  postOnly: boolean,
  call: BatchCall,
) {
  if (postOnly && call.method !== "post") {
    return {
      status: 405,
      body: frameworkError("methodNotAllowed"),
    };
  }
  const selected = selectBatchRoute(
    routes,
    versions,
    call.method,
    call.path,
    requested,
  );
  if (!selected) {
    return { status: 404, body: frameworkError("notFound") };
  }
  try {
    const response = await runMiddleware(
      [
        ...middleware.map((definition) => ({
          definition,
          allowFields: false,
        })),
        ...selected.route.middleware.map((definition) => ({
          definition,
          allowFields: true,
        })),
      ],
      {
        request: callRequest(request, call, token),
        version: requested.id,
        params: stringParams(call.params),
      },
      async (fields) => {
        const parsed = parseCall(selected.route, call);
        if (!parsed.ok) {
          return Response.json(
            frameworkError("invalidRequest", { issues: parsed.issues }),
            { status: 400 },
          );
        }
        return selected.route.handle({ ...parsed.input, fields });
      },
    );
    return await callResult(response);
  } catch {
    return { status: 500, body: { message: "The call failed." } };
  }
}

export function parseCall(route: RouteDefinition, call: BatchCall) {
  const input: {
    params?: unknown;
    query?: unknown;
    body?: unknown;
  } = {};
  if (route.request.params) {
    const parsed = route.request.params.safeParse(call.params ?? {});
    if (!parsed.success) {
      return { ok: false as const, issues: parsed.error.issues };
    }
    input.params = parsed.data;
  }
  if (route.request.query) {
    const parsed = route.request.query.safeParse(call.query ?? {});
    if (!parsed.success) {
      return { ok: false as const, issues: parsed.error.issues };
    }
    input.query = parsed.data;
  }
  if (route.request.body) {
    if (call.body === undefined) {
      return {
        ok: false as const,
        issues: [{ message: "Request body must be JSON" }],
      };
    }
    const parsed = route.request.body.safeParse(call.body);
    if (!parsed.success) {
      return { ok: false as const, issues: parsed.error.issues };
    }
    input.body = parsed.data;
  }
  return { ok: true as const, input };
}

function selectBatchRoute(
  routes: readonly RouteDefinition[],
  versions: readonly VersionDefinition[],
  method: string,
  path: string,
  requested: VersionDefinition,
) {
  const matches = [];
  for (const route of routes) {
    if (route.method !== method || route.path !== path) {
      continue;
    }
    const version = versions.find((item) => item.id === route.version);
    if (!version || isAfterVersion(version, requested)) {
      continue;
    }
    matches.push({ route, version });
  }
  matches.sort((left, right) => {
    if (left.version.releasedAt !== right.version.releasedAt) {
      return right.version.releasedAt - left.version.releasedAt;
    }
    return right.version.number - left.version.number;
  });
  return matches[0] ?? null;
}

function callRequest(request: Request, call: BatchCall, token: string) {
  const url = new URL(request.url);
  url.pathname = `/${token}${call.path}`;
  url.search = "";
  for (const [key, value] of Object.entries(call.query ?? {})) {
    if (typeof value === "string") {
      url.searchParams.set(key, value);
    }
  }
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  const sendBody = call.body !== undefined && call.method !== "get";
  if (sendBody) {
    headers.set("content-type", "application/json");
  }
  const init: RequestInit = {
    method: call.method.toUpperCase(),
    headers,
  };
  if (sendBody) {
    init.body = JSON.stringify(call.body);
  }
  return new Request(url.href, init);
}

function stringParams(params: Record<string, unknown> | undefined) {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (typeof value === "string") {
      values[key] = value;
    }
  }
  return values;
}

async function callResult(response: Response) {
  const text = await response.text();
  if (text.length === 0) {
    return { status: response.status, body: null };
  }
  try {
    return { status: response.status, body: JSON.parse(text) as unknown };
  } catch {
    return { status: response.status, body: text };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
