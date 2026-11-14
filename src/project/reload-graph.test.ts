import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { freshImportUrl, resolveProjectImport } from "./reload-graph.ts";

describe("project reload imports", () => {
  const root = path.resolve("keja-app");
  const route = path.join(root, "src", "public", "posts.ts");

  it("adds a generation to a project file import", () => {
    expect(freshImportUrl(route, "4")).toBe(`keja:${route}?keja=4`);
  });

  it("follows a relative import out of the route directory", () => {
    const resolved = resolveProjectImport({
      importer: `keja:${route}`,
      specifier: "../data.ts",
      projectRoot: root,
      generation: "4",
    });
    const file = path.join(root, "src", "data.ts");
    expect(resolved).toEqual({
      path: `${file}?keja=4`,
      namespace: "keja",
      file,
      outside: false,
    });
  });

  it("adds a TypeScript extension to an extensionless relative import", () => {
    const project = mkdtempSync(path.join(tmpdir(), "keja-reload-"));
    const repositories = path.join(project, "src", "db", "repositories.ts");
    const importer = path.join(
      project,
      "src",
      "public",
      "config",
      "tenants.ts",
    );
    mkdirSync(path.dirname(repositories), { recursive: true });
    mkdirSync(path.dirname(importer), { recursive: true });
    writeFileSync(repositories, "export {}\n");
    try {
      const resolved = resolveProjectImport({
        importer: `keja:${importer}`,
        specifier: "../../db/repositories",
        projectRoot: project,
        generation: "4",
      });
      expect(resolved?.file).toBe(repositories);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it("follows the next file imported by that dependency", () => {
    const data = path.join(root, "src", "data.ts");
    const resolved = resolveProjectImport({
      importer: `keja:${data}?keja=4`,
      specifier: "./schema.ts",
      projectRoot: root,
      generation: "4",
    });
    const file = path.join(root, "src", "schema.ts");
    expect(resolved?.path).toBe(`${file}?keja=4`);
    expect(resolved?.file).toBe(file);
  });

  it("leaves package imports cached", () => {
    expect(
      resolveProjectImport({
        importer: `keja:${route}`,
        specifier: "@veducio/keja",
        projectRoot: root,
        generation: "4",
      }),
    ).toBeNull();
  });
});
