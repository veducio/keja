import { Chalk, type ChalkInstance } from "chalk";
import {
  type BunCheck,
  type BunRuntime,
  checkBun,
  checkEnv,
  checkMachine,
  type MachineCheck,
  type MachineInfo,
} from "./checks.ts";

export type SelfTestResult =
  | {
      ok: false;
      step: "bun" | "machine" | "env";
      error: string;
    }
  | {
      ok: true;
      bun: Extract<BunCheck, { ok: true }>;
      machine: Extract<MachineCheck, { ok: true }>;
    };

export type SelfTestOptions = {
  runtime?: BunRuntime | undefined;
  machine?: MachineInfo;
  env?: Record<string, string | undefined>;
};

export function runSelfTest(options: SelfTestOptions = {}): SelfTestResult {
  const runtime = Object.hasOwn(options, "runtime")
    ? options.runtime
    : globalThis.Bun;
  const bun = checkBun(runtime);
  if (!bun.ok) {
    return { ok: false, step: "bun", error: bun.error };
  }

  const machine = checkMachine(options.machine);
  if (!machine.ok) {
    return { ok: false, step: "machine", error: machine.error };
  }

  const env = options.env ?? runtime?.env ?? process.env;
  const checkedEnv = checkEnv(env);
  if (!checkedEnv.ok) {
    return { ok: false, step: "env", error: checkedEnv.error };
  }

  return { ok: true, bun, machine };
}

export function formatSelfTest(result: SelfTestResult, color = false): string {
  const style = ink(color);
  const heading = `  ${style.dim("SELF TEST")}`;
  if (!result.ok) {
    const details = result.error
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n");
    return `\n${heading}\n\n  ${style.red(`x ${stepLabel(result.step)}`)}\n${details}\n\n  ${style.red("failed, exiting")}\n`;
  }
  return [
    "",
    heading,
    "",
    row("Bun", result.bun.version, style),
    row(
      "Machine",
      `${result.machine.platform} ${result.machine.arch} ${result.machine.hostname}`,
      style,
    ),
    row("Env", "ready", style),
    "",
    `  ${style.green("successful")}`,
    "",
  ].join("\n");
}

function stepLabel(step: "bun" | "machine" | "env") {
  if (step === "bun") {
    return "Bun";
  }
  if (step === "machine") {
    return "Machine";
  }
  return "Env";
}

function row(label: string, value: string, style: ChalkInstance) {
  return `  ${style.dim(`- ${label.padEnd(8)}`)} ${value}`;
}

function ink(color: boolean) {
  return new Chalk({ level: color ? 1 : 0 });
}

if (import.meta.main) {
  const result = runSelfTest();
  if (!result.ok) {
    console.error(formatSelfTest(result, process.stderr.isTTY === true));
    process.exit(1);
  }
  console.log(formatSelfTest(result, process.stdout.isTTY === true));
}
