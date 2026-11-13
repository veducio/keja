import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { frameworkError, projectError } from "../errors/framework-errors.ts";
import type { RouteDefinition } from "../route/define.ts";
import {
  type MiddlewareDefinition,
  runMiddleware,
} from "../route/middleware.ts";
import type { ServiceIdentity } from "../server/identity.ts";
import {
  resolveVersionToken,
  type VersionDefinition,
} from "../versioning/define.ts";
import { selectRoute } from "../versioning/select.ts";
import { runBatch } from "./batch.ts";
import { createOpenApiDocument } from "./openapi.ts";

export function createHttpApp(options: {
  title: string;
  versions: readonly VersionDefinition[];
  routes: readonly RouteDefinition[];
  middleware?: readonly MiddlewareDefinition<object>[];
  server?: string | null;
  identity?: ServiceIdentity;
  postOnly?: boolean;
  batch?: boolean;
}) {
  const batch = options.batch !== false;
  validateRoutes(options.versions, options.routes, options.postOnly === true);
  const document = createOpenApiDocument(
    options.title,
    options.routes,
    options.server,
    options.versions,
    options.postOnly === true,
    batch,
  );
  const app = new Hono();
  app.get("/_health", (c) => c.json({ status: "ok" }));
  if (options.identity) {
    app.get("/_identity", (c) => c.json(options.identity));
  }
  app.get("/_openapi.json", (c) => c.json(document));
  app.get(
    "/docs",
    Scalar({
      url: "/_openapi.json",
      hideClientButton: true,
      showDeveloperTools: "never",
    }),
  );
  app.all("/*", (c) =>
    dispatch(
      c.req.raw,
      options.versions,
      options.routes,
      options.middleware ?? [],
      options.postOnly === true,
      batch,
    ),
  );
  return app;
}

async function dispatch(
  request: Request,
  versions: readonly VersionDefinition[],
  routes: readonly RouteDefinition[],
  middleware: readonly MiddlewareDefinition<object>[],
  postOnly: boolean,
  batch: boolean,
) {
  if (postOnly && request.method !== "POST") {
    return Response.json(frameworkError("methodNotAllowed"), { status: 405 });
  }
  const url = new URL(request.url);
  const pathname = url.pathname;
  const slash = pathname.indexOf("/", 1);
  const token = slash === -1 ? pathname.slice(1) : pathname.slice(1, slash);
  const remainder = slash === -1 ? "/" : pathname.slice(slash);
  if (token.length === 0) {
    return Response.json(frameworkError("notFound"), { status: 404 });
  }
  const requested = resolveVersionToken(token, versions);
  if (!requested) {
    return Response.json(frameworkError("unknownVersion"), { status: 404 });
  }
  if (request.method === "POST" && remainder === "/batch") {
    if (!batch) {
      return Response.json(frameworkError("notFound"), { status: 404 });
    }
    return runBatch(
      request,
      versions,
      routes,
      middleware,
      requested,
      token,
      postOnly,
    );
  }
  const selected = selectRoute(
    routes,
    versions,
    request.method,
    remainder,
    requested,
  );
  if (!selected) {
    return Response.json(frameworkError("notFound"), { status: 404 });
  }
  return runMiddleware(
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
      request,
      version: requested.id,
      params: selected.params,
    },
    async (fields) => {
      const parsed = await parseRequest(
        selected.route,
        selected.params,
        url,
        request,
      );
      if (!parsed.ok) {
        return Response.json(
          frameworkError("invalidRequest", { issues: parsed.issues }),
          { status: 400 },
        );
      }
      return selected.route.handle({ ...parsed.input, fields });
    },
  );
}

async function parseRequest(
  route: RouteDefinition,
  params: Record<string, string>,
  url: URL,
  request: Request,
) {
  const input: {
    params?: unknown;
    query?: unknown;
    body?: unknown;
  } = {};
  if (route.request.params) {
    const parsed = route.request.params.safeParse(params);
    if (!parsed.success) {
      return { ok: false as const, issues: parsed.error.issues };
    }
    input.params = parsed.data;
  }
  if (route.request.query) {
    const parsed = route.request.query.safeParse(
      Object.fromEntries(url.searchParams),
    );
    if (!parsed.success) {
      return { ok: false as const, issues: parsed.error.issues };
    }
    input.query = parsed.data;
  }
  if (route.request.body) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return {
        ok: false as const,
        issues: [{ message: "Request body must be JSON" }],
      };
    }
    const parsed = route.request.body.safeParse(body);
    if (!parsed.success) {
      return { ok: false as const, issues: parsed.error.issues };
    }
    input.body = parsed.data;
  }
  return { ok: true as const, input };
}

function validateRoutes(
  versions: readonly VersionDefinition[],
  routes: readonly RouteDefinition[],
  postOnly: boolean,
) {
  const known = new Set(versions.map((version) => version.id));
  const seen = new Set<string>();
  for (const route of routes) {
    if (route.method === "post" && route.path === "/batch") {
      throw projectError("invalidRoute", "POST /batch is reserved");
    }
    if (postOnly && route.method !== "post") {
      throw projectError(
        "serviceMethod",
        `${route.method.toUpperCase()} ${route.path} must use POST`,
      );
    }
    if (!known.has(route.version)) {
      throw projectError(
        "unknownRouteVersion",
        `${route.method.toUpperCase()} ${route.path} uses unknown version ${route.version}`,
      );
    }
    const key = `${route.method} ${route.path} ${route.version}`;
    if (seen.has(key)) {
      throw projectError("duplicateRoute", `Duplicate route ${key}`);
    }
    seen.add(key);
  }
}
