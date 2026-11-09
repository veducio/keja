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
