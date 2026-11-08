import { Chalk } from "chalk";
import { describe, expect, it } from "vitest";
import { checkEnv, checkMachine } from "./checks.ts";
import { formatSelfTest, runSelfTest } from "./run.ts";

const validEnv = {
  HOST: "127.0.0.1",
  HTTP_PORT: "3000",
  HTTP_SERVICE_PORT: "3001",
};

describe("runSelfTest", () => {
  it("stops when the process is not Bun", () => {
    const result = runSelfTest({
      runtime: undefined,
      env: {},
    });
    expect(result).toEqual({
      ok: false,
      step: "bun",
      error: "Process is not running in Bun",
    });
  });

  it("checks the machine after Bun and before env", () => {
    const result = runSelfTest({
      runtime: { version: "1.4.4", env: validEnv },
      machine: { platform: "freebsd", arch: "x64", hostname: "test" },
      env: {},
    });
    expect(result).toEqual({
      ok: false,
      step: "machine",
      error: "Unsupported platform freebsd",
    });
  });

  it("checks required env after the machine", () => {
    const result = runSelfTest({
      runtime: { version: "1.4.4" },
      machine: { platform: "linux", arch: "x64", hostname: "test" },
      env: { HOST: "127.0.0.1" },
    });
    if (result.ok) {
      throw new Error("expected env check to fail");
    }
    expect(result.step).toBe("env");
    const checked = checkEnv({
      HOST: " ",
      HTTP_PORT: "70000",
      HTTP_SERVICE_PORT: "3001",
    });
    if (checked.ok) {
      throw new Error("expected env check to fail");
    }
    expect(checked.error).toContain("HOST is required");
    expect(checked.error).toContain(
      "HTTP_PORT must be an integer from 1 to 65535",
    );
    const openApi = checkEnv({
      ...validEnv,
      OPENAPI_SERVER: "notaurl",
    });
    if (openApi.ok) {
      throw new Error("expected openapi server check to fail");
    }
    expect(openApi.error).toContain(
      "OPENAPI_SERVER must be an absolute http or https URL",
    );
  });

  it("prints the checks in the same rows as the server addresses", () => {
    expect(
      formatSelfTest({
        ok: true,
        bun: { ok: true, version: "1.4.4" },
        machine: {
          ok: true,
          platform: "win32",
          arch: "x64",
          hostname: "Plomyk",
        },
      }),
    ).toBe(
      "\n  SELF TEST\n\n  - Bun      1.4.4\n  - Machine  win32 x64 Plomyk\n  - Env      ready\n\n  successful\n",
    );
    expect(
      formatSelfTest({
        ok: false,
        step: "env",
        error: "HOST is required\nHTTP_PORT must be an integer from 1 to 65535",
      }),
    ).toBe(
      "\n  SELF TEST\n\n  x Env\n    HOST is required\n    HTTP_PORT must be an integer from 1 to 65535\n\n  failed, exiting\n",
    );
    const style = new Chalk({ level: 1 });
    const passed = formatSelfTest(
      {
        ok: true,
        bun: { ok: true, version: "1.4.4" },
        machine: {
          ok: true,
          platform: "win32",
          arch: "x64",
          hostname: "Plomyk",
        },
      },
      true,
    );
    expect(passed).toContain(style.green("successful"));
    const failed = formatSelfTest(
      { ok: false, step: "env", error: "HOST is required" },
      true,
    );
    expect(failed).toContain(style.red("failed, exiting"));
    expect(failed).toContain(style.red("x Env"));
  });

  it("accepts this machine when the platform and architecture are supported", () => {
    const machine = checkMachine();
    if (!machine.ok) {
      throw new Error(machine.error);
    }
    expect(["darwin", "linux", "win32"]).toContain(machine.platform);
    expect(["arm64", "x64"]).toContain(machine.arch);
    expect(machine.hostname.length).toBeGreaterThan(0);
  });
});
