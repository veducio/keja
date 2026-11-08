import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defineConfig, loadConfig, resolveProjectPaths } from "./config.ts";

describe("defineConfig", () => {
  it("uses the default project paths", () => {
    expect(defineConfig()).toMatchObject({
      versioning: "keja.versioning.ts",
      public: "src/public",
      service: "src/service",
    });
  });

  it("keeps the paths that are set", () => {
    expect(
      defineConfig({
        versioning: "config/versions.ts",
        public: "routes/public",
      }),
    ).toMatchObject({
      versioning: "config/versions.ts",
      public: "routes/public",
      service: "src/service",
    });
  });

  it("keeps the database disabled until it is turned on", () => {
    expect(defineConfig().database).toEqual({ enabled: false });
    expect(defineConfig({ db: false }).database).toEqual({ enabled: false });
    expect(defineConfig({ db: true }).database).toEqual({
      enabled: true,
      migrations: "migrations",
    });
    expect(
      defineConfig({ db: { migrations: "db/migrations" } }).database,
    ).toEqual({
      enabled: true,
      migrations: "db/migrations",
    });
  });

  it("rejects an empty path", () => {
    expect(() => defineConfig({ service: "  " })).toThrow(
      "keja.config.ts service must be a non-empty path",
    );
  });

  it("keeps an optional Argus registry", () => {
    expect(
      defineConfig({
        name: "billing",
        argus: {
          url: "https://argus.veducio.com/",
          env: "staging",
          username: "argus",
          password: "secret",
          public: "billing",
        },
      }).argus,
    ).toEqual({
      url: "https://argus.veducio.com",
      env: "staging",
      username: "argus",
      password: "secret",
      public: "billing",
      service: null,
    });
    expect(() =>
      defineConfig({
        argus: { url: "argus.veducio.com", env: "staging" },
      }),
    ).toThrow("keja.config.ts argus.url must be an absolute http or https URL");
  });
});

describe("loadConfig", () => {
  it("resolves the default paths from the project root", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "keja-config-"));
    await expect(loadConfig(root)).resolves.toEqual({
      config: null,
      name: null,
      argus: null,
      database: { enabled: false },
      versioning: path.resolve(root, "keja.versioning.ts"),
      public: path.resolve(root, "src/public"),
      service: path.resolve(root, "src/service"),
    });
  });

  it("resolves custom paths from the project root", () => {
    const root = path.resolve("app");
    expect(
      resolveProjectPaths(
        root,
        defineConfig({
          versioning: "versioning/api.ts",
          public: "http/public",
          service: "http/service",
        }),
      ),
    ).toEqual({
      versioning: path.resolve(root, "versioning/api.ts"),
      public: path.resolve(root, "http/public"),
      service: path.resolve(root, "http/service"),
    });
  });
});
