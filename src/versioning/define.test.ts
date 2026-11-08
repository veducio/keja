import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineRoute, response } from "../route/define.ts";
import {
  defineVersions,
  parseReleasedAt,
  resolveVersionToken,
} from "./define.ts";

const versions = defineVersions({
  v1: { releasedAt: "2020-01-15" },
  v2: { releasedAt: "01-06-2024" },
}).versions;

describe("parseReleasedAt", () => {
  it("accepts calendar dates and unix timestamps", () => {
    expect(parseReleasedAt("2020-09-20")).toBe(Date.UTC(2020, 8, 20));
    expect(parseReleasedAt("20-09-2020")).toBe(Date.UTC(2020, 8, 20));
    expect(parseReleasedAt(1_600_560_000)).toBe(1_600_560_000_000);
    expect(parseReleasedAt(1_600_560_000_000)).toBe(1_600_560_000_000);
    expect(parseReleasedAt("2020-13-40")).toBeNull();
  });
});

describe("defineVersions", () => {
  it("accepts v followed by a whole number", () => {
    expect(
      defineVersions({
        v0: { releasedAt: "2020-01-15" },
        v10: { releasedAt: "2024-06-01" },
      }).versions.map((version) => version.number),
    ).toEqual([0, 10]);
  });

  it("rejects a version that is not v followed by a whole number", () => {
    expect(() =>
      defineVersions({
        "v1.2": { releasedAt: "2020-01-15" },
      } as never),
    ).toThrow("Version v1.2 must use the form v1, v2, v3");
    expect(() =>
      defineVersions({
        v01: { releasedAt: "2020-01-15" },
      } as never),
    ).toThrow("Version v01 must use the form v1, v2, v3");
  });
});

describe("defineRoute version", () => {
  it("rejects a version that is not v followed by a whole number", () => {
    expect(() =>
      defineRoute({
        method: "get",
        path: "/users",
        version: "v1.2",
        responses: {
          Ok: response({ code: 200, json: z.object({}) }),
        },
        handler: () => new Response(),
      } as never),
    ).toThrow("Version v1.2 must use the form v1, v2, v3");
  });
});

describe("resolveVersionToken", () => {
  it("selects the newest version that is not after the requested date", () => {
    expect(resolveVersionToken("2020-09-20", versions)?.id).toBe("v1");
    expect(resolveVersionToken("2024-06-01", versions)?.id).toBe("v2");
    expect(resolveVersionToken("15-01-2020", versions)?.id).toBe("v1");
    expect(resolveVersionToken("2019-01-01", versions)).toBeNull();
  });

  it("selects named versions and the latest keyword", () => {
    expect(resolveVersionToken("v1", versions)?.id).toBe("v1");
    expect(resolveVersionToken("v9", versions)).toBeNull();
    expect(resolveVersionToken("latest", versions)?.id).toBe("v2");
    expect(resolveVersionToken("CURRENT", versions)?.id).toBe("v2");
  });
});
