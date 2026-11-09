import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const namespace = "keja";
const generationKey = "keja";

let projectRoot: string | null = null;
let generation: string | null = null;
let pluginInstalled = false;
const outsideProject = new Set<string>();

export function freshImportUrl(file: string, token: string) {
  return `${namespace}:${path.resolve(file)}?${generationKey}=${token}`;
}

export function resolveProjectImport(input: {
  importer: string;
  specifier: string;
  projectRoot: string;
  generation: string;
}) {
  const specifier = input.specifier.split("?")[0] ?? input.specifier;
  if (!isRelativeSpecifier(specifier)) {
    return null;
  }
  const importerFile = filePath(input.importer);
  if (!importerFile || isNodeModules(importerFile)) {
    return null;
  }
  const inProject = isInside(importerFile, input.projectRoot);
  const inGraph =
    input.importer.startsWith(`${namespace}:`) ||
    input.importer.includes(`${generationKey}=`);
  if (!inProject && !inGraph) {
    return null;
  }
  const resolved = path.resolve(path.dirname(importerFile), specifier);
  if (isNodeModules(resolved)) {
    return null;
  }
  return {
    path: `${resolved}?${generationKey}=${input.generation}`,
    namespace,
    file: resolved,
    outside: !isInside(resolved, input.projectRoot),
  };
}

export function beginProjectReload(root: string, token: string) {
  projectRoot = path.resolve(root);
  generation = token;
  outsideProject.clear();
  installPlugin();
}

export function projectDependenciesOutsideRoot() {
  return [...outsideProject];
}

function installPlugin() {
  if (pluginInstalled) {
    return;
  }
  const runtime = globalThis as {
    Bun?: { plugin?: (plugin: BunPlugin) => void };
  };
  if (!runtime.Bun?.plugin) {
    return;
  }
  pluginInstalled = true;
  runtime.Bun.plugin({
    name: "keja-dev-reload",
    setup(build) {
      build.onResolve({ filter: /^\.{1,2}(?:[\\/]|$)/ }, (args) => {
        if (!projectRoot || !generation) {
          return null;
        }
        if (!args.importer.startsWith(`${namespace}:`)) {
          return null;
        }
        const resolved = resolveProjectImport({
          importer: args.importer,
          specifier: args.path,
          projectRoot,
          generation,
        });
        if (!resolved) {
          return null;
        }
        if (resolved.outside) {
          outsideProject.add(resolved.file);
        }
        return { path: resolved.path, namespace: resolved.namespace };
      });
      build.onLoad({ filter: /.*/, namespace }, (args) => {
        const file = filePath(args.path);
        if (!file) {
          return null;
        }
        return {
          contents: readFileSync(file, "utf8"),
          loader: loaderFor(file),
        };
      });
    },
  });
}

type BunPlugin = {
  name: string;
  setup: (build: {
    onResolve: (
      constraints: { filter: RegExp },
      callback: (args: { importer: string; path: string }) => {
        path: string;
        namespace: string;
      } | null,
    ) => void;
    onLoad: (
      constraints: { filter: RegExp; namespace: string },
      callback: (args: { path: string }) => {
        contents: string;
        loader: "js" | "jsx" | "ts" | "tsx" | "json";
      } | null,
    ) => void;
  }) => void;
};

function loaderFor(file: string) {
  const extension = path.extname(file).toLowerCase();
  if (extension === ".tsx") {
    return "tsx" as const;
  }
  if (extension === ".jsx") {
    return "jsx" as const;
  }
  if (extension === ".js" || extension === ".mjs" || extension === ".cjs") {
    return "js" as const;
  }
  if (extension === ".json") {
    return "json" as const;
  }
  return "ts" as const;
}

function isRelativeSpecifier(specifier: string) {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

function filePath(importer: string) {
  const withoutQuery = importer.split("?")[0] ?? importer;
  const clean = withoutQuery.startsWith(`${namespace}:`)
    ? withoutQuery.slice(namespace.length + 1)
    : withoutQuery;
  if (clean.startsWith("file:")) {
    return fileURLToPath(clean);
  }
  if (path.isAbsolute(clean)) {
    return clean;
  }
  return null;
}

function isNodeModules(file: string) {
  return file.split(/[\\/]/).includes("node_modules");
}

function isInside(file: string, root: string) {
  const relative = path.relative(root, file);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}
