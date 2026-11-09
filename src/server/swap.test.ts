import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createHttpApp } from "../http/create-app.ts";
import { defineRoute, response } from "../route/define.ts";
import { defineVersions } from "../versioning/define.ts";
import { swapProjectHandlers } from "./swap.ts";

const versions = defineVersions({
  v1: { releasedAt: "2026-01-01" },
  v2: { releasedAt: "2026-06-01" },
}).versions;

describe("project handler swap", () => {
  it("reloads openapi and docs on both servers", async () => {
    const first = apps("/notes", "v1");
    const second = apps("/posts", "v2");
    const fetches: Array<(request: Request) => Response | Promise<Response>> =
      [];
    const server = () => ({
      reload(options: {
        fetch: (request: Request) => Response | Promise<Response>;
      }) {
        fetches.push(options.fetch);
      },
    });
    swapProjectHandlers(
      { publicServer: server(), serviceServer: server() },
      second,
    );
    expect(
      await (await first.publicApp.request("/_openapi.json")).json(),
    ).toMatchObject({
      paths: { "/v1/notes": { get: expect.any(Object) } },
    });
    const publicSpec = await fetches[0]?.(
      new Request("http://localhost/_openapi.json"),
    );
    const serviceSpec = await fetches[1]?.(
      new Request("http://localhost/_openapi.json"),
    );
    const publicDocs = await fetches[0]?.(new Request("http://localhost/docs"));
    expect(publicSpec?.status).toBe(200);
    expect(await publicSpec?.json()).toMatchObject({
      paths: { "/v2/posts": { get: expect.any(Object) } },
    });
    expect(serviceSpec?.status).toBe(200);
    expect(await serviceSpec?.json()).toMatchObject({
      paths: { "/v2/posts": { post: expect.any(Object) } },
    });
    expect(publicDocs?.status).toBe(200);
    expect(await publicDocs?.text()).toContain("/_openapi.json");
  });
});

function apps(routePath: string, version: "v1" | "v2") {
  const routes = [
    defineRoute({
      method: "get",
      path: routePath,
      version,
      responses: {
        Ok: response({ code: 200, json: z.object({ ok: z.literal(true) }) }),
      },
      handler: ({ respond }) => respond.Ok({ ok: true }),
    }),
    defineRoute({
      method: "post",
      path: routePath,
      version,
      responses: {
        Ok: response({ code: 200, json: z.object({ ok: z.literal(true) }) }),
      },
      handler: ({ respond }) => respond.Ok({ ok: true }),
    }),
  ];
  return {
    publicApp: createHttpApp({
      title: "Public",
      versions,
      routes: routes.filter((route) => route.method === "get"),
    }),
    serviceApp: createHttpApp({
      title: "Service",
      versions,
      routes: routes.filter((route) => route.method === "post"),
      postOnly: true,
    }),
  };
}
