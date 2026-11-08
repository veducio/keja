import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineRoute, response } from "../route/define.ts";
import { collectRouteFiles, routesFromModule } from "./load.ts";

describe("collectRouteFiles", () => {
  it("keeps route modules nested several directories deep", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "keja-routes-"));
    const publicDirectory = path.join(root, "public");
    mkdirSync(path.join(publicDirectory, "orgs", "teams"), {
      recursive: true,
    });
    writeFileSync(path.join(publicDirectory, "_middleware.ts"), "");
    writeFileSync(path.join(publicDirectory, "orgs", "_middleware.ts"), "");
    writeFileSync(
      path.join(publicDirectory, "orgs", "teams", "members.ts"),
      "",
    );
    writeFileSync(
      path.join(publicDirectory, "orgs", "teams", "members.test.ts"),
      "",
    );

    await expect(collectRouteFiles(publicDirectory)).resolves.toEqual([
      "orgs/teams/members.ts",
    ]);
  });
});

describe("routesFromModule", () => {
  it("reads a default route and named routes from one module", () => {
    const ready = route("get", "/ready");
    const list = route("get", "/jobs");
    const create = route("post", "/jobs");
    expect(
      routesFromModule({
        default: ready,
        list,
        create,
        schema: z.object({ name: z.string() }),
      }).map((item) => `${item.method} ${item.path}`),
    ).toEqual(["get /ready", "get /jobs", "post /jobs"]);
    expect(routesFromModule({ schema: z.string() })).toEqual([]);
  });
});

function route(method: "get" | "post", routePath: string) {
  return defineRoute({
    method,
    path: routePath,
    version: "v1",
    responses: {
      Ok: response({ code: 200, json: z.object({ ok: z.literal(true) }) }),
    },
    handler: ({ respond }) => respond.Ok({ ok: true }),
  });
}
