import { describe, expect, it } from "vitest";
import { createHttpApp } from "../http/create-app.ts";
import { defineVersions } from "../versioning/define.ts";

describe("createServer import", () => {
  it("does not listen when the http app is created", async () => {
    const app = createHttpApp({
      title: "Public",
      versions: defineVersions({ v1: { releasedAt: "2020-01-15" } }).versions,
      routes: [],
    });
    const response = await app.request("/_health");
    expect(response.status).toBe(200);
  });
});
