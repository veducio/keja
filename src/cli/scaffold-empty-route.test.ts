import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  emptyRouteSource,
  routePathFromFile,
  scaffoldEmptyRouteFile,
  scaffoldEmptyRoutes,
} from "./scaffold-empty-route.ts";

describe("scaffold empty route", () => {
  it("derives a path from the file name", () => {
    expect(routePathFromFile("src/public/notes.ts")).toBe("/notes");
    expect(routePathFromFile("hello.world.ts")).toBe("/hello.world");
    expect(routePathFromFile("bad name.ts")).toBe("/route");
  });

  it("writes a public get stub and a service post stub", () => {
    expect(emptyRouteSource("public", "/items")).toContain('method: "get"');
    expect(emptyRouteSource("public", "/items")).toContain('path: "/items"');
    expect(emptyRouteSource("service", "/jobs")).toContain('method: "post"');
  });

  it("fills an empty route file once", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "keja-scaffold-"));
    const file = path.join(directory, "items.ts");
    await writeFile(file, "");
    expect(await scaffoldEmptyRouteFile(file, "public")).toBe(true);
    const first = await readFile(file, "utf8");
    expect(first).toContain('path: "/items"');
    expect(await scaffoldEmptyRouteFile(file, "public")).toBe(false);
    expect(await readFile(file, "utf8")).toBe(first);
  });

  it("fills empty route modules under public and service folders", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "keja-scaffold-dirs-"));
    const publicDir = path.join(root, "public");
    const serviceDir = path.join(root, "service");
    mkdirSync(publicDir);
    mkdirSync(serviceDir);
    writeFileSync(path.join(publicDir, "notes.ts"), "   \n");
    writeFileSync(path.join(publicDir, "_middleware.ts"), "");
    writeFileSync(path.join(serviceDir, "jobs.ts"), "");
    writeFileSync(path.join(publicDir, "ready.ts"), "export {}\n");
    const written = await scaffoldEmptyRoutes(publicDir, serviceDir);
    expect(written.sort()).toEqual(
      [
        path.join(publicDir, "notes.ts"),
        path.join(serviceDir, "jobs.ts"),
      ].sort(),
    );
    expect(await readFile(path.join(publicDir, "notes.ts"), "utf8")).toContain(
      'method: "get"',
    );
    expect(await readFile(path.join(serviceDir, "jobs.ts"), "utf8")).toContain(
      'method: "post"',
    );
    expect(await readFile(path.join(publicDir, "_middleware.ts"), "utf8")).toBe(
      "",
    );
    expect(await readFile(path.join(publicDir, "ready.ts"), "utf8")).toBe(
      "export {}\n",
    );
  });
});
