import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineRoute, response } from "./define.ts";

const ok = response({ code: 200, json: z.object({ id: z.string() }) });

describe("defineRoute", () => {
  it("rejects a method, a path, and a schema that are not usable", () => {
    expect(() =>
      route({
        method: "GET" as "get",
        path: "/posts",
        responses: { Ok: ok },
      }),
    ).toThrow("Method GET must be get, post, put, patch, or delete");
    expect(() =>
      route({
        method: "get",
        path: "posts",
        responses: { Ok: ok },
      }),
    ).toThrow("Path posts must start with /");
    expect(() =>
      route({
        method: "get",
        path: "/posts",
        responses: {
          Posts: response({
            code: 200,
            json: z.array(undefined as never),
          }),
        },
      }),
    ).toThrow("GET /posts response Posts must be a Zod schema");
  });

  it("accepts a nested path and a response array", () => {
    expect(() =>
      route({
        method: "get",
        path: "/orgs/:orgId/teams/:teamId",
        responses: {
          Teams: response({
            code: 200,
            json: z.object({
              teams: z.array(z.object({ id: z.string() })),
            }),
          }),
        },
      }),
    ).not.toThrow();
  });
});

function route(definition: {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  responses: Record<string, { code: number; json: z.ZodType }>;
}) {
  return defineRoute({
    ...definition,
    version: "v1",
    handler: () => new Response(),
  });
}
