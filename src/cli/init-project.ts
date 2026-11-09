import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  copyFile,
  cp,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const projectName = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export type InitInput = {
  name?: string;
  dir?: string;
  public?: string;
  service?: string;
};

export type InitAnswers = {
  name: string;
  directory: string;
  publicDir: string;
  serviceDir: string;
};

type Ask = (label: string, fallback: string) => Promise<string>;

type Run = (command: string, args: string[], cwd: string) => Promise<number>;

const publicHello = `import { defineRoute, response } from "@veducio/keja";
import { z } from "zod";

export default defineRoute({
  method: "get",
  path: "/hello",
  version: "v1",
  responses: {
    Hello: response({
      code: 200,
      json: z.object({ message: z.string() }),
    }),
  },
  handler: ({ respond }) => respond.Hello({ message: "hello" }),
});
`;

const publicMiddleware = `import { defineMiddleware } from "@veducio/keja";

export default defineMiddleware(async ({ next }) => {
  const response = await next();
  response.headers.set("x-keja", "public");
  return response;
});
`;

const servicePing = `import { defineRoute, response } from "@veducio/keja";
import { z } from "zod";

export default defineRoute({
  method: "post",
  path: "/ping",
  version: "v1",
  responses: {
    Pong: response({
      code: 200,
      json: z.object({ ok: z.literal(true) }),
    }),
  },
  handler: ({ respond }) => respond.Pong({ ok: true }),
});
`;

export async function resolveInitAnswers(input: InitInput, ask: Ask) {
  const name = await valueOrAsk(
    input.name,
    "Name of the project",
    "my-app",
    ask,
  );
  if (!projectName.test(name)) {
    throw new Error(
      "Project name must use letters, numbers, dots, hyphens, or underscores.",
    );
  }
  const directory = await valueOrAsk(
    input.dir,
    "Where you want to create the project",
    `./${name}`,
    ask,
  );
  if (directory.trim() === "") {
    throw new Error("Project directory is required.");
  }
  return {
    name,
    directory: directory.trim(),
    publicDir: routeFolder(
      await valueOrAsk(
        input.public,
        "What folder should the public server be",
        "./src/public",
        ask,
      ),
      "Public server folder",
    ),
    serviceDir: routeFolder(
      await valueOrAsk(
        input.service,
        "What folder should the service server be",
        "./src/service",
        ask,
      ),
      "Service server folder",
    ),
  } satisfies InitAnswers;
}

export async function createProject(options: {
  answers: InitAnswers;
  cwd: string;
  templateDir: string;
  packageRoot: string;
  run: Run;
}) {
  await requireGit(options.run, options.cwd);
  const destination = path.resolve(options.cwd, options.answers.directory);
  if (existsSync(destination)) {
    const entries = await readdir(destination);
    if (entries.length > 0) {
      throw new Error(`${destination} already exists and is not empty.`);
    }
  }
  await cp(options.templateDir, destination, {
    recursive: true,
    filter(source) {
      const base = path.basename(source);
      return base !== "node_modules" && base !== ".git";
    },
  });
  const envFile = path.join(destination, ".env");
  const envExample = path.join(destination, ".env.example");
  if (!existsSync(envFile) && existsSync(envExample)) {
    await copyFile(envExample, envFile);
  }
  const kejaVersion = await readKejaVersion(options.packageRoot);
  await writeFile(
    path.join(destination, "package.json"),
    `${JSON.stringify(
      {
        name: options.answers.name,
        version: "0.1.0",
        private: true,
        type: "module",
        scripts: {
          dev: "keja dev",
          start: "keja start",
        },
        dependencies: {
          "@veducio/keja": `^${kejaVersion}`,
          zod: "^4.6.7",
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(destination, "keja.config.ts"),
    configSource(options.answers.publicDir, options.answers.serviceDir),
  );
  await writeFile(
    path.join(destination, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2023",
          lib: ["ES2023"],
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          isolatedModules: true,
          forceConsistentCasingInFileNames: true,
          allowImportingTsExtensions: true,
        },
        include: ["**/*.ts"],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(destination, ".npmrc"),
    "@veducio:registry=https://npm.pkg.github.com\n",
  );
  await writeRoute(
    destination,
    options.answers.publicDir,
    "_middleware.ts",
    publicMiddleware,
  );
  await writeRoute(
    destination,
    options.answers.publicDir,
    "hello.ts",
    publicHello,
  );
  await writeRoute(
    destination,
    options.answers.serviceDir,
    "ping.ts",
    servicePing,
  );
  const initCode = await options.run("git", ["init"], destination);
  if (initCode !== 0) {
    throw new Error(`git init failed in ${destination}`);
  }
  return destination;
}

export async function runInit(options: {
  input: InitInput;
  cwd: string;
  templateDir: string;
  packageRoot: string;
  interactive: boolean;
  ask: Ask;
  run: Run;
  log: (message: string) => void;
}) {
  const answers = await resolveInitAnswers(
    options.input,
    options.interactive ? options.ask : async (_label, fallback) => fallback,
  );
  const directory = await createProject({
    answers,
    cwd: options.cwd,
    templateDir: options.templateDir,
    packageRoot: options.packageRoot,
    run: options.run,
  });
  options.log(`\n  Created ${answers.name} at ${directory}\n`);
  return directory;
}

export function starterPaths(moduleUrl = import.meta.url) {
  return {
    templateDir: fileUrl(new URL("../../examples/starter", moduleUrl)),
    packageRoot: fileUrl(new URL("../..", moduleUrl)),
  };
}

export async function askOnTerminal(label: string, fallback: string) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return await rl.question(`  ${label} (${fallback}): `);
  } finally {
    rl.close();
  }
}

export function runCommand(command: string, args: string[], cwd: string) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "ignore",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function requireGit(run: Run, cwd: string) {
  try {
    const code = await run("git", ["--version"], cwd);
    if (code !== 0) {
      throw new Error("Git is required to create a project.");
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Git is required to create a project."
    ) {
      throw error;
    }
    throw new Error("Git is required to create a project.");
  }
}

async function valueOrAsk(
  given: string | undefined,
  label: string,
  fallback: string,
  ask: Ask,
) {
  if (typeof given === "string" && given.trim() !== "") {
    return given.trim();
  }
  const answered = (await ask(label, fallback)).trim();
  return answered === "" ? fallback : answered;
}

function routeFolder(value: string, label: string) {
  const cleaned = value
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
  const parts = cleaned.split("/");
  if (
    cleaned === "" ||
    cleaned === "." ||
    path.isAbsolute(value.trim()) ||
    /^[A-Za-z]:/.test(value.trim()) ||
    parts.some((part) => part.length === 0 || part === "..")
  ) {
    throw new Error(`${label} must be a path inside the project.`);
  }
  return cleaned;
}

async function readKejaVersion(packageRoot: string) {
  const source = await readFile(path.join(packageRoot, "package.json"), "utf8");
  const parsed = JSON.parse(source) as { version?: unknown };
  if (typeof parsed.version !== "string" || parsed.version.trim() === "") {
    throw new Error("Keja package.json is missing a version.");
  }
  return parsed.version.trim();
}

function configSource(publicDir: string, serviceDir: string) {
  return `import { defineConfig } from "@veducio/keja";

export default defineConfig({
  public_path: ${JSON.stringify(publicDir)},
  service_path: ${JSON.stringify(serviceDir)},
  db: { enabled: true },
});
`;
}

async function writeRoute(
  destination: string,
  folder: string,
  file: string,
  source: string,
) {
  const directory = path.join(destination, ...folder.split("/"));
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, file), source);
}

function fileUrl(url: URL) {
  return fileURLToPath(url);
}
