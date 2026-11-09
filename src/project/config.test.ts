import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defineConfig, loadConfig, resolveProjectPaths } from "./config.ts";

describe("defineConfig", () => {
  it("uses the default project paths", () => {
    expect(defineConfig()).toMatchObject({
      versioning: "keja.versioning.ts",
      public_path: "src/public",
      service_path: "src/service",
    });
  });

  it("keeps the paths that are set", () => {
    expect(
      defineConfig({
        versioning: "config/versions.ts",
        public_path: "routes/public",
      }),
    ).toMatchObject({
      versioning: "config/versions.ts",
      public_path: "routes/public",
      service_path: "src/service",
    });
  });

  it("keeps the database disabled until it is turned on", () => {
    expect(defineConfig().database).toEqual({ enabled: false });
    expect(defineConfig({ db: { enabled: false } }).database).toEqual({
      enabled: false,
    });
    expect(defineConfig({ db: { enabled: true } }).database).toEqual({
      enabled: true,
      migrations: "migrations",
    });
    expect(
      defineConfig({
        db: { enabled: true, migrations: "db/migrations" },
      }).database,
    ).toEqual({
      enabled: true,
      migrations: "db/migrations",
    });
  });

  it("rejects an empty path", () => {
    expect(() => defineConfig({ service_path: "  " })).toThrow(
      "keja.config.ts service_path must be a non-empty path",
    );
  });

  it("keeps an optional Argus registry", () => {
    expect(
      defineConfig({
        name: "billing",
        argus: {
          enabled: true,
          url: "https://argus.veducio.com/",
          env: "staging",
          username: "argus",
          password: "secret",
          public: "billing",
        },
      }).argus,
    ).toEqual({
      enabled: true,
      url: "https://argus.veducio.com",
      env: "staging",
      username: "argus",
      password: "secret",
      public: "billing",
      service: null,
    });
    expect(defineConfig({ argus: { enabled: false } }).argus).toEqual({
      enabled: false,
    });
    expect(() =>
      defineConfig({
        argus: { enabled: true, url: "argus.veducio.com", env: "staging" },
      }),
    ).toThrow("keja.config.ts argus.url must be an absolute http or https URL");
  });

  it("reads Vault settings from config", () => {
    expect(
      defineConfig({
        vault: {
          enabled: true,
          address: "https://vault.example/",
          token: "s.token",
          namespace: "apps",
          mount: "kv",
        },
      }).vault,
    ).toEqual({
      enabled: true,
      address: "https://vault.example",
      token: "s.token",
      namespace: "apps",
      mount: "kv",
      transit_key: null,
      transit_mount: "transit",
      grant_max_exp: 900,
    });
    expect(defineConfig().vault).toEqual({ enabled: false });
  });
});

describe("loadConfig", () => {
  it("resolves the default paths from the project root", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "keja-config-"));
    await expect(loadConfig(root)).resolves.toEqual({
      config: null,
      name: null,
      argus: { enabled: false },
      database: { enabled: false },
      vault: { enabled: false },
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
          public_path: "http/public",
          service_path: "http/service",
        }),
      ),
    ).toEqual({
      versioning: path.resolve(root, "versioning/api.ts"),
      public: path.resolve(root, "http/public"),
      service: path.resolve(root, "http/service"),
    });
  });
});
