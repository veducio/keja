import { readFileSync } from "node:fs";
import path from "node:path";
import { Chalk } from "chalk";

export const veducioAnnotation =
  "Veducio Keja is part of Veducio and its Labs program, with a mission to contribute quality software to open source.";

export function projectLabel(
  pkg: { name?: string; version?: string },
  fallbackName: string,
) {
  const name = pkg.name?.trim() || fallbackName;
  const version = pkg.version?.trim();
  return version ? `${name} ${version}` : name;
}

export function readProjectLabel(root = process.cwd()) {
  const project = readProject(root);
  return projectLabel(project, project.name);
}

export function formatBanner(options: {
  name: string;
  version?: string;
  color?: boolean;
}) {
  const style = ink(options.color === true);
  const version = options.version?.trim();
  const title = version
    ? `${style.bold(options.name)} ${style.dim(version)}`
    : style.bold(options.name);
  const note = wrap(veducioAnnotation, 72)
    .map((line) => `  ${style.dim(line)}`)
    .join("\n");
  return `\n  ${title}\n\n${note}\n`;
}

export function formatAddresses(
  publicUrl: string,
  serviceUrl: string,
  color = false,
) {
  const style = ink(color);
  const row = (label: string, url: string) =>
    `  ${style.dim(`- ${label.padEnd(8)}`)} ${url}`;
  return `\n${row("Public", publicUrl)}\n${row("Service", serviceUrl)}\n`;
}

export function printStartup(root = process.cwd()) {
  const project = readProject(root);
  console.log(
    formatBanner({
      name: project.name,
      version: project.version,
      color: process.stdout.isTTY,
    }),
  );
}

export function formatProjectPaths(
  paths: {
    config: string | null;
    versioning: string;
    public: string;
    service: string;
  },
  color = false,
) {
  const style = ink(color);
  const row = (label: string, value: string) =>
    `  ${style.dim(`- ${label.padEnd(10)}`)} ${value}`;
  return `\n${row("Config", paths.config ?? "defaults")}\n${row("Versioning", paths.versioning)}\n${row("Public", paths.public)}\n${row("Service", paths.service)}\n`;
}

export function printProjectPaths(paths: {
  config: string | null;
  versioning: string;
  public: string;
  service: string;
}) {
  console.log(formatProjectPaths(paths, process.stdout.isTTY === true));
}

export function formatIdentity(
  identity: { name: string; public: string[]; service: string[] },
  argus?: { url: string; env: string } | null,
  color = false,
  vault?: { address: string; mount: string } | null,
) {
  const style = ink(color);
  const row = (label: string, value: string) =>
    `  ${style.dim(`- ${label.padEnd(10)}`)} ${value}`;
  const lines = [
    row("Name", identity.name),
    row("Public", identity.public.join(", ")),
    row("Service", identity.service.join(", ")),
  ];
  if (argus) {
    lines.push(row("Argus", `${argus.url} (${argus.env})`));
  }
  if (vault) {
    lines.push(row("Vault", `${vault.address} (${vault.mount})`));
  }
  return `\n${lines.join("\n")}\n`;
}

export function printIdentity(
  identity: { name: string; public: string[]; service: string[] },
  argus?: { url: string; env: string } | null,
  vault?: { address: string; mount: string } | null,
) {
  console.log(
    formatIdentity(identity, argus, process.stdout.isTTY === true, vault),
  );
}

export function formatDatabase(
  database:
    | { migrations: string; applied: string[] }
    | { connected: true }
    | null,
  color = false,
) {
  const style = ink(color);
  const row = (label: string, value: string) =>
    `  ${style.dim(`- ${label.padEnd(10)}`)} ${value}`;
  if (!database) {
    return `\n${row("Database", "disabled")}\n`;
  }
  if (!("applied" in database)) {
    return `\n${row("Database", "postgres")}\n`;
  }
  const applied =
    database.applied.length > 0 ? database.applied.join(", ") : "up to date";
  return `\n${row("Database", "postgres")}\n${row("Migrations", database.migrations)}\n${row("Applied", applied)}\n`;
}

export function printDatabase(
  database:
    | { migrations: string; applied: string[] }
    | { connected: true }
    | null,
) {
  console.log(formatDatabase(database, process.stdout.isTTY === true));
}

export function printAddresses(publicUrl: string, serviceUrl: string) {
  console.log(
    formatAddresses(publicUrl, serviceUrl, process.stdout.isTTY === true),
  );
}

export function formatReloading(color = false) {
  const style = ink(color);
  return `\n  ${style.dim("reloading...")}\n`;
}

export function formatProjectReady(color = false) {
  const style = ink(color);
  return `\n  ${style.green("no issues found")}\n`;
}

export function printReloading() {
  console.log(formatReloading(process.stdout.isTTY === true));
}

export function printProjectReady() {
  console.log(formatProjectReady(process.stdout.isTTY === true));
}

function readProject(root: string) {
  const fallbackName = path.basename(root);
  try {
    const parsed = JSON.parse(
      readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { name?: unknown; version?: unknown };
    return {
      name:
        typeof parsed.name === "string" && parsed.name.trim()
          ? parsed.name.trim()
          : fallbackName,
      version: typeof parsed.version === "string" ? parsed.version : undefined,
    };
  } catch {
    return { name: fallbackName, version: undefined };
  }
}

function ink(color: boolean) {
  return new Chalk({ level: color ? 1 : 0 });
}

function wrap(text: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
      continue;
    }
    line = next;
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}
