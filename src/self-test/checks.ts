import os from "node:os";
import {
  type EnvSource,
  openApiServerEnv,
  requiredEnv,
  validateOpenApiServer,
} from "../env/required-env.ts";

const supportedPlatforms = new Set(["darwin", "linux", "win32"]);
const supportedArchitectures = new Set(["arm64", "x64"]);

export type BunRuntime = {
  version?: string;
  env?: EnvSource;
};

export type MachineInfo = {
  platform: string;
  arch: string;
  hostname: string;
};

type Failure = {
  ok: false;
  error: string;
};

export type BunCheck =
  | {
      ok: true;
      version: string;
    }
  | Failure;

export type MachineCheck = ({ ok: true } & MachineInfo) | Failure;

export type EnvCheck = { ok: true } | Failure;

export function checkBun(runtime: BunRuntime | undefined): BunCheck {
  if (
    runtime == null ||
    typeof runtime.version !== "string" ||
    runtime.version === ""
  ) {
    return { ok: false, error: "Process is not running in Bun" };
  }
  return { ok: true, version: runtime.version };
}

export function checkMachine(
  machine: MachineInfo = readMachine(),
): MachineCheck {
  if (!supportedPlatforms.has(machine.platform)) {
    return { ok: false, error: `Unsupported platform ${machine.platform}` };
  }
  if (!supportedArchitectures.has(machine.arch)) {
    return { ok: false, error: `Unsupported architecture ${machine.arch}` };
  }
  return { ok: true, ...machine };
}

export function checkEnv(env: EnvSource): EnvCheck {
  const errors: string[] = [];
  for (const requirement of requiredEnv) {
    const error = requirement.validate(env[requirement.name]);
    if (error) {
      errors.push(error);
    }
  }
  for (const server of openApiServerEnv) {
    const error = validateOpenApiServer(server.name, env[server.name]);
    if (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    return { ok: false, error: errors.join("\n") };
  }
  return { ok: true };
}

function readMachine(): MachineInfo {
  return {
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
  };
}
