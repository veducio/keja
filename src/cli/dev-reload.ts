import { existsSync, watch as watchDirectory } from "node:fs";
import path from "node:path";
import type { LoadedProject } from "../project/load.ts";
import { loadProject } from "../project/load.ts";
import { projectDependenciesOutsideRoot } from "../project/reload-graph.ts";
import { listen } from "../server/index.ts";
import { printProjectReady, printReloading } from "./banner.ts";
import {
  formatProjectFailure,
  printServers,
  readProjectFailure,
} from "./run-project.ts";

export const reloadDebounceMs = 50;

export function isIgnoredWatch(file: string) {
  return file
    .split(/[\\/]/)
    .some(
      (part) => part === "node_modules" || part === ".git" || part === "dist",
    );
}

export function watchDirectories(
  root: string,
  paths: LoadedProject["paths"],
  outside: readonly string[],
) {
  const dirs = [
    root,
    paths.public,
    paths.service,
    path.dirname(paths.versioning),
  ];
  if (paths.config) {
    dirs.push(path.dirname(paths.config));
  }
  for (const file of outside) {
    dirs.push(path.dirname(file));
  }
  return [...new Set(dirs.map((dir) => path.resolve(dir)))];
}

export async function refreshDevProject(input: {
  running: boolean;
  load: () => Promise<LoadedProject>;
  boot: () => Promise<void>;
  swap: (project: LoadedProject) => void;
}) {
  if (!input.running) {
    try {
      await input.boot();
      return "booted" as const;
    } catch (error) {
      return { error, waiting: true as const };
    }
  }
  try {
    const project = await input.load();
    input.swap(project);
    return "reloaded" as const;
  } catch (error) {
    return { error, waiting: false as const };
  }
}

export function subscribeDirectories(
  directories: readonly string[],
  onFile: (file: string | null) => void,
  open: (
    directory: string,
    onFile: (file: string | null) => void,
  ) => { close: () => void } = defaultWatch,
) {
  const watchers = new Map<string, { close: () => void }>();
  const add = (directory: string) => {
    const resolved = path.resolve(directory);
    if (watchers.has(resolved) || !existsSync(resolved)) {
      return;
    }
    watchers.set(resolved, open(resolved, onFile));
  };
  for (const directory of directories) {
    add(directory);
  }
  return {
    add,
    close() {
      for (const watcher of watchers.values()) {
        watcher.close();
      }
      watchers.clear();
    },
  };
}

export async function runDev(root = process.cwd()) {
  let running: Awaited<ReturnType<typeof listen>> | null = null;
  let generation = 0;
  let busy = false;
  let queued = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const refresh = async () => {
    if (busy) {
      queued = true;
      return;
    }
    busy = true;
    try {
      generation += 1;
      const token = String(generation);
      if (running) {
        printReloading();
      }
      const result = await refreshDevProject({
        running: running !== null,
        load: () => loadProject(root, { generation: token }),
        boot: async () => {
          running = await listen(root, { generation: token });
          printServers(running);
        },
        swap(project) {
          running?.reload(project);
        },
      });
      if (result === "reloaded") {
        printProjectReady();
      } else if (typeof result === "object") {
        console.error(
          formatProjectFailure(readProjectFailure(result.error), {
            wait: result.waiting,
            color: process.stderr.isTTY === true,
          }),
        );
      }
      if (running) {
        for (const directory of watchDirectories(
          root,
          running.paths,
          projectDependenciesOutsideRoot(),
        )) {
          subscription.add(directory);
        }
      }
    } finally {
      busy = false;
      if (queued) {
        queued = false;
        await refresh();
      }
    }
  };
  const subscription = subscribeDirectories([root], (file) => {
    if (file && isIgnoredWatch(file)) {
      return;
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      void refresh();
    }, reloadDebounceMs);
  });
  await refresh();
  await new Promise(() => {});
}

function defaultWatch(
  directory: string,
  onFile: (file: string | null) => void,
) {
  const watcher = watchDirectory(
    directory,
    { recursive: true },
    (_event, filename) => {
      onFile(filename === null ? null : String(filename));
    },
  );
  watcher.on("error", () => {});
  return { close: () => watcher.close() };
}
