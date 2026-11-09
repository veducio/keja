import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isIgnoredWatch,
  refreshDevProject,
  subscribeDirectories,
  watchDirectories,
} from "./dev-reload.ts";

describe("dev reload", () => {
  it("does not relaunch the process under bun --watch", () => {
    const entry = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const dev = readFileSync(
      new URL("./commands/dev.ts", import.meta.url),
      "utf8",
    );
    expect(entry.includes("--watch")).toBe(false);
    expect(dev.includes("--watch")).toBe(false);
  });

  it("watches the project and route dependencies outside it", () => {
    const root = path.resolve("app");
    expect(isIgnoredWatch("node_modules/pkg/index.ts")).toBe(true);
    expect(isIgnoredWatch("src/data.ts")).toBe(false);
    expect(
      watchDirectories(
        root,
        {
          config: path.join(root, "keja.config.ts"),
          versioning: path.join(root, "keja.versioning.ts"),
          public: path.join(root, "src", "public"),
          service: path.join(root, "src", "service"),
        },
        ["D:/shared/schema.ts"],
      ),
    ).toContain(path.resolve("D:/shared"));
  });

  it("keeps the running project when a reload fails", async () => {
    let swapped = false;
    const result = await refreshDevProject({
      running: true,
      load: () => Promise.reject(new Error("bad route")),
      boot: () => Promise.resolve(),
      swap: () => {
        swapped = true;
      },
    });
    expect(swapped).toBe(false);
    expect(result).toEqual({
      error: expect.any(Error),
      waiting: false,
    });
  });

  it("boots when the servers are not up yet", async () => {
    let booted = false;
    const result = await refreshDevProject({
      running: false,
      load: () => Promise.reject(new Error("unused")),
      boot: () => {
        booted = true;
        return Promise.resolve();
      },
      swap: () => {
        throw new Error("swap");
      },
    });
    expect(booted).toBe(true);
    expect(result).toBe("booted");
  });

  it("subscribes through the injected watcher", () => {
    const opened: string[] = [];
    const subscription = subscribeDirectories(
      [process.cwd()],
      () => {},
      (directory) => {
        opened.push(directory);
        return { close() {} };
      },
    );
    expect(opened).toEqual([path.resolve(process.cwd())]);
    subscription.close();
  });
});
