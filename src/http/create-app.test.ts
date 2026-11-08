import { describe, expect, it } from "vitest";
import { z } from "zod";
import { frameworkErrors } from "../errors/framework-errors.ts";
import { defineRoute, response } from "../route/define.ts";
import { defineMiddleware } from "../route/middleware.ts";
import { defineVersions } from "../versioning/define.ts";
import { createHttpApp } from "./create-app.ts";

const versions = defineVersions({
  v1: { releasedAt: "2020-01-15" },
  v2: { releasedAt: "2024-06-01" },
}).versions;

const userResponse = z.object({
  id: z.string(),
});

const publicRoutes = [
  defineRoute({
    method: "get",
    path: "/users/:id",
    version: "v1",
    request: {
      params: z.object({ id: z.string().min(1) }),
    },
    responses: {
      User: response({ code: 200, json: userResponse }),
    },
    handler: ({ params, respond }) => respond.User({ id: params.id }),
  }),
];

const serviceRoutes = [
  defineRoute({
    method: "post",
    path: "/jobs",
    version: "v2",
    request: {
      body: z.object({ name: z.string() }),
    },
    responses: {
      Created: response({ code: 201, json: z.object({ name: z.string() }) }),
    },
    handler: ({ body, respond }) => respond.Created(body),
  }),
];

describe("createHttpApp", () => {
  const publicApp = createHttpApp({
    title: "Public",
    versions,
    routes: publicRoutes,
    server: "http://127.0.0.1:3500",
  });
  const serviceApp = createHttpApp({
    title: "Service",
    versions,
    routes: serviceRoutes,
    server: "https://service.example",
    postOnly: true,
  });

  it("serves health, OpenAPI, and Scalar docs on both servers", async () => {
    for (const app of [publicApp, serviceApp]) {
      const health = await app.request("/_health");
      expect(health.status).toBe(200);
      await expect(health.json()).resolves.toEqual({ status: "ok" });

      const docs = await app.request("/docs");
      expect(docs.status).toBe(200);
      expect(docs.headers.get("content-type")).toContain("text/html");
      const html = await docs.text();
      expect(html).toContain('"hideClientButton": true');
      expect(html).toContain('"showDeveloperTools": "never"');
    }

    const identified = createHttpApp({
      title: "Public",
      versions,
      routes: publicRoutes,
      identity: {
        name: "billing",
        public: ["http://192.168.1.10:3000"],
        service: ["http://192.168.1.10:3001"],
      },
    });
    const identity = await identified.request("/_identity");
    expect(identity.status).toBe(200);
    await expect(identity.json()).resolves.toEqual({
      name: "billing",
      public: ["http://192.168.1.10:3000"],
      service: ["http://192.168.1.10:3001"],
    });

    const spec = await publicApp.request("/_openapi.json");
    const document = (await spec.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
      servers?: { url: string }[];
    };
    expect(document.openapi).toMatch(/^3\./);
    expect(document.paths["/v1/users/{id}"]).toBeDefined();
    expect(document.servers).toEqual([{ url: "http://127.0.0.1:3500" }]);

    const serviceSpec = await serviceApp.request("/_openapi.json");
    const serviceDocument = (await serviceSpec.json()) as {
      servers?: { url: string }[];
    };
    expect(serviceDocument.servers).toEqual([
      { url: "https://service.example" },
    ]);
  });

  it("runs the newest available handler and validates the request", async () => {
    const found = await publicApp.request("/v2/users/ada");
    expect(found.status).toBe(200);
    await expect(found.json()).resolves.toEqual({ id: "ada" });

    const dated = await publicApp.request("/2020-09-20/users/ada");
    expect(dated.status).toBe(200);

    const invalid = await publicApp.request("/latest/users/");
    expect(invalid.status).toBe(404);
    await expect(invalid.json()).resolves.toEqual(frameworkErrors.notFound);

    const missing = await publicApp.request("/2019-01-01/users/ada");
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual(
      frameworkErrors.unknownVersion,
    );

    const service = await serviceApp.request("/v1/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "sync" }),
    });
    expect(service.status).toBe(404);
    await expect(service.json()).resolves.toEqual(frameworkErrors.notFound);

    const getJob = await serviceApp.request("/v2/jobs");
    expect(getJob.status).toBe(405);
    await expect(getJob.json()).resolves.toEqual(
      frameworkErrors.methodNotAllowed,
    );

    const created = await serviceApp.request("/current/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "sync" }),
    });
    expect(created.status).toBe(201);

    const rejected = await serviceApp.request("/v2/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(rejected.status).toBe(400);
    await expect(rejected.json()).resolves.toMatchObject(
      frameworkErrors.invalidRequest,
    );
  });

  it("rejects a service route that is not POST", () => {
    expect(() =>
      createHttpApp({
        title: "Service",
        versions,
        routes: publicRoutes,
        postOnly: true,
      }),
    ).toThrow("GET /users/:id must use POST");
  });

  it("fills constant response fields that are not handler arguments", async () => {
    const app = createHttpApp({
      title: "Public",
      versions,
      routes: [
        defineRoute({
          method: "get",
          path: "/missing/:id",
          version: "v1",
          request: { params: z.object({ id: z.string() }) },
          responses: {
            IdDoesNotExist: response({
              code: 404,
              json: z.object({
                id: z.string(),
                error: z.literal("ID_DOES_NOT_EXIST"),
              }),
              const: { error: "ID_DOES_NOT_EXIST" },
            }),
            Gone: response({
              code: 410,
              json: z.object({ error: z.literal("GONE") }),
              const: { error: "GONE" },
            }),
          },
          handler: ({ params, respond }) =>
            params.id === "gone"
              ? respond.Gone()
              : respond.IdDoesNotExist(params),
        }),
      ],
    });

    const missing = await app.request("/v1/missing/ada");
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({
      id: "ada",
      error: "ID_DOES_NOT_EXIST",
    });

    const gone = await app.request("/v1/missing/gone");
    expect(gone.status).toBe(410);
    await expect(gone.json()).resolves.toEqual({ error: "GONE" });
  });

  it("runs code around next and passes values into the handler", async () => {
    const events: string[] = [];
    const server = defineMiddleware(async ({ next }) => {
      events.push("server-before");
      const response = await next();
      events.push("server-after");
      response.headers.set("x-server", "yes");
      return response;
    });
    const route = defineMiddleware(async ({ version, params, next }) => {
      events.push("route-before");
      const response = await next({ seen: `${version}:${params.id}` });
      events.push("route-after");
      response.headers.set("x-route", "yes");
      return response;
    });
    const app = createHttpApp({
      title: "Public",
      versions,
      middleware: [server],
      routes: [
        defineRoute({
          method: "get",
          path: "/items/:id",
          version: "v1",
          request: { params: z.object({ id: z.string() }) },
          middleware: [route],
          responses: {
            Ok: response({
              code: 200,
              json: z.object({ seen: z.string() }),
            }),
          },
          handler: ({ seen, respond }) => {
            events.push("handler");
            return respond.Ok({ seen });
          },
        }),
      ],
    });

    const health = await app.request("/_health");
    expect(health.status).toBe(200);
    expect(events).toEqual([]);

    const result = await app.request("/v2/items/ada");
    expect(result.status).toBe(200);
    expect(result.headers.get("x-server")).toBe("yes");
    expect(result.headers.get("x-route")).toBe("yes");
    await expect(result.json()).resolves.toEqual({ seen: "v2:ada" });
    expect(events).toEqual([
      "server-before",
      "route-before",
      "handler",
      "route-after",
      "server-after",
    ]);
  });

  it("stops the chain when middleware returns its own response", async () => {
    let handled = false;
    const app = createHttpApp({
      title: "Public",
      versions,
      routes: [
        defineRoute({
          method: "get",
          path: "/items/:id",
          version: "v1",
          middleware: [
            defineMiddleware(async () =>
              Response.json({ message: "Unauthorized" }, { status: 401 }),
            ),
          ],
          responses: {
            Ok: response({ code: 200, json: z.object({}) }),
          },
          handler: ({ respond }) => {
            handled = true;
            return respond.Ok({});
          },
        }),
      ],
    });

    const result = await app.request("/v1/items/ada");
    expect(result.status).toBe(401);
    await expect(result.json()).resolves.toEqual({
      message: "Unauthorized",
    });
    expect(handled).toBe(false);
  });

  it("returns the framework error when a response misses its schema", async () => {
    const app = createHttpApp({
      title: "Public",
      versions,
      routes: [
        defineRoute({
          method: "get",
          path: "/items/:id",
          version: "v1",
          request: { params: z.object({ id: z.string() }) },
          responses: {
            Ok: response({
              code: 200,
              json: z.object({ id: z.string() }),
            }),
          },
          handler: ({ respond }) => respond.Ok({ id: 1 } as never),
        }),
      ],
    });

    const result = await app.request("/v1/items/ada");
    expect(result.status).toBe(500);
    await expect(result.json()).resolves.toMatchObject(
      frameworkErrors.invalidResponse,
    );
  });
});
