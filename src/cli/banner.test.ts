import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Chalk } from "chalk";
import { describe, expect, it } from "vitest";
import {
  formatAddresses,
  formatBanner,
  formatDatabase,
  formatIdentity,
  formatProjectPaths,
  formatProjectReady,
  formatReloading,
  projectLabel,
  readProjectLabel,
  veducioAnnotation,
} from "./banner.ts";

describe("projectLabel", () => {
  it("prints the package name and version", () => {
    expect(projectLabel({ name: "example-app", version: "0.1.0" }, "app")).toBe(
      "example-app 0.1.0",
    );
    expect(projectLabel({}, "app")).toBe("app");
  });

  it("reads the project package and keeps the Veducio annotation", () => {
    const root = mkdtempSync(path.join(tmpdir(), "keja-"));
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "@veducio/keja", version: "0.1.0" }),
    );
    expect(readProjectLabel(root)).toBe("@veducio/keja 0.1.0");
    expect(veducioAnnotation).toBe(
      "Veducio Keja is part of Veducio and its Labs program, with a mission to contribute quality software to open source.",
    );
  });

  it("lays the banner and addresses out like a dev server", () => {
    expect(formatBanner({ name: "example-app", version: "0.1.0" })).toBe(
      `\n  example-app 0.1.0\n\n  Veducio Keja is part of Veducio and its Labs program, with a mission to\n  contribute quality software to open source.\n`,
    );
    expect(
      formatAddresses("http://127.0.0.1:3500", "http://127.0.0.1:3501"),
    ).toBe(
      "\n  - Public   http://127.0.0.1:3500\n  - Service  http://127.0.0.1:3501\n",
    );
    expect(
      formatIdentity(
        {
          name: "billing",
          public: ["http://192.168.1.10:3000"],
          service: ["http://192.168.1.10:3001"],
        },
        { url: "https://argus.veducio.com", env: "staging" },
      ),
    ).toBe(
      "\n  - Name       billing\n  - Public     http://192.168.1.10:3000\n  - Service    http://192.168.1.10:3001\n  - Argus      https://argus.veducio.com (staging)\n",
    );
    expect(formatDatabase(null)).toBe("\n  - Database   disabled\n");
    expect(
      formatDatabase({
        migrations: "C:/app/migrations",
        applied: ["0001_init.sql"],
      }),
    ).toBe(
      "\n  - Database   postgres\n  - Migrations C:/app/migrations\n  - Applied    0001_init.sql\n",
    );
    expect(
      formatProjectPaths({
        config: "C:/app/keja.config.ts",
        versioning: "C:/app/keja.versioning.ts",
        public: "C:/app/src/public",
        service: "C:/app/src/service",
      }),
    ).toBe(
      "\n  - Config     C:/app/keja.config.ts\n  - Versioning C:/app/keja.versioning.ts\n  - Public     C:/app/src/public\n  - Service    C:/app/src/service\n",
    );
    expect(
      formatProjectPaths({
        config: null,
        versioning: "C:/app/keja.versioning.ts",
        public: "C:/app/src/public",
        service: "C:/app/src/service",
      }),
    ).toContain("- Config     defaults");
  });

  it("prints reloading and a clean project", () => {
    const style = new Chalk({ level: 1 });
    expect(formatReloading()).toBe("\n  reloading...\n");
    expect(formatProjectReady()).toBe("\n  no issues found\n");
    expect(formatReloading(true)).toBe(`\n  ${style.dim("reloading...")}\n`);
    expect(formatProjectReady(true)).toBe(
      `\n  ${style.green("no issues found")}\n`,
    );
  });
});
