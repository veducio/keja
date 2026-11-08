import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineRoute, response } from "../route/define.ts";
import { defineVersions } from "./define.ts";
import { selectRoute } from "./select.ts";

const versions = defineVersions({
  v1: { releasedAt: "2020-01-15" },
  v2: { releasedAt: "2024-06-01" },
}).versions;

const user = z.object({ id: z.string() });

const routes = [
  defineRoute({
    method: "get",
    path: "/users/:id",
    version: "v1",
    request: { params: user },
    responses: {
      User: response({ code: 200, json: user }),
    },
    handler: ({ params, respond }) => respond.User(params),
  }),
  defineRoute({
    method: "get",
    path: "/reports",
    version: "v2",
    responses: {
      Ready: response({ code: 200, json: z.object({ ok: z.literal(true) }) }),
    },
    handler: ({ respond }) => respond.Ready({ ok: true }),
  }),
];

describe("selectRoute", () => {
  it("uses the newest handler that is not after the requested version", () => {
    const v2 = versions.find((version) => version.id === "v2");
    const v1 = versions.find((version) => version.id === "v1");
    if (!v2 || !v1) {
      throw new Error("missing versions");
    }
    expect(
      selectRoute(routes, versions, "GET", "/users/1", v2)?.route.version,
    ).toBe("v1");
    expect(selectRoute(routes, versions, "GET", "/reports", v1)).toBeNull();
    expect(
      selectRoute(routes, versions, "GET", "/reports", v2)?.route.version,
    ).toBe("v2");
  });

  it("matches a route nested several segments deep", () => {
    const v1 = versions.find((version) => version.id === "v1");
    if (!v1) {
      throw new Error("missing versions");
    }
    const deep = defineRoute({
      method: "get",
      path: "/orgs/:orgId/teams/:teamId/members/:memberId",
      version: "v1",
      responses: {
        Member: response({ code: 200, json: z.object({ id: z.string() }) }),
      },
      handler: ({ respond }) => respond.Member({ id: "ada" }),
    });
    const selected = selectRoute(
      [deep],
      versions,
      "GET",
      "/orgs/acme/teams/core/members/ada",
      v1,
    );
    expect(selected?.params).toEqual({
      orgId: "acme",
      teamId: "core",
      memberId: "ada",
    });
  });
});
