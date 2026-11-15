import { Chalk } from "chalk";
import { ProjectError } from "../errors/framework-errors.ts";
import { listen } from "../server/index.ts";
import {
  printAddresses,
  printDatabase,
  printIdentity,
  printProjectPaths,
  printProjectReady,
} from "./banner.ts";

export type ProjectFailure = {
  scope: string;
  code?: number;
  name?: string;
  detail: string;
  description?: string;
  tip?: string;
};

export function printServers(servers: Awaited<ReturnType<typeof listen>>) {
  printProjectPaths(servers.paths);
  printIdentity(
    servers.identity,
    servers.argus.enabled ? servers.argus : null,
    servers.vault.enabled
      ? { address: servers.vault.address, mount: servers.vault.mount }
      : null,
  );
  printDatabase(servers.database);
  printAddresses(
    `http://${servers.publicServer.hostname}:${servers.publicServer.port}`,
    `http://${servers.serviceServer.hostname}:${servers.serviceServer.port}`,
  );
  printProjectReady();
}

export async function runProject(options?: { wait?: boolean }) {
  try {
    printServers(await listen());
  } catch (error) {
    console.error(
      formatProjectFailure(readProjectFailure(error), {
        wait: options?.wait === true,
        color: process.stderr.isTTY === true,
      }),
    );
    if (options?.wait) {
      await new Promise(() => {});
      return;
    }
    process.exit(1);
  }
}

export function readProjectFailure(error: unknown): ProjectFailure {
  if (error instanceof ProjectError) {
    return {
      scope: error.scope,
      code: error.code,
      name: error.errorName,
      detail: error.message,
      description: error.description,
      tip: error.tip,
    };
  }
  return {
    scope: "Project",
    detail: formatUnknownFailure(error),
  };
}

export function formatUnknownFailure(error: unknown) {
  if (!(error instanceof Error)) {
    return "Failed to start";
  }
  const nested = nestedFailures(error);
  if (nested.length === 0) {
    return error.message;
  }
  return [
    error.message,
    ...nested.map((item) => formatNestedFailure(item)),
  ].join("\n");
}

function nestedFailures(error: Error) {
  const errors = (error as { errors?: unknown }).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return errors;
  }
  if (error.cause !== undefined) {
    return [error.cause];
  }
  return [];
}

function formatNestedFailure(error: unknown) {
  if (
    !(error instanceof Error) &&
    (typeof error !== "object" || error === null)
  ) {
    return String(error);
  }
  const item = error as {
    message?: string;
    position?: {
      file?: string;
      line?: number;
      column?: number;
      lineText?: string;
    };
  };
  const message =
    typeof item.message === "string" && item.message !== ""
      ? item.message
      : error instanceof Error
        ? error.message
        : String(error);
  const position = item.position;
  if (!position?.file) {
    return message;
  }
  const line = position.line ?? 0;
  const column = position.column ?? 0;
  const lines = [message, `at ${position.file}:${line}:${column}`];
  if (typeof position.lineText === "string" && position.lineText !== "") {
    lines.push(position.lineText);
    if (column > 0) {
      lines.push(`${" ".repeat(Math.max(0, column - 1))}^`);
    }
  }
  return lines.join("\n");
}

export function formatProjectFailure(
  failure: ProjectFailure,
  options: { wait: boolean; color?: boolean },
) {
  const style = new Chalk({ level: options.color ? 1 : 0 });
  const badge = style.bgRed.white.bold(" ERROR ");
  const identity =
    failure.code !== undefined && failure.name
      ? `  ${style.dim(String(failure.code))} ${style.bold(failure.name)}`
      : "";
  const details = [failure.detail, failure.description, failure.tip]
    .filter((line) => line !== undefined)
    .join("\n")
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
  const waiting = options.wait
    ? `\n\n  ${style.dim("waiting for changes")}\n`
    : "\n";
  return `\n  ${badge} ${style.bold(failure.scope)}${identity}\n${details}${waiting}`;
}
