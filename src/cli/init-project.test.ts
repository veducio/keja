import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createProject, resolveInitAnswers, runInit } from "./init-project.ts";

const ask = async (label: string, fallback: string) => {
  asked.push([label, fallback]);
  return answers.shift() ?? "";
};

let asked: [string, string][] = [];
let answers: string[] = [];

describe("resolveInitAnswers", () => {
  it("keeps flags and skips prompts", async () => {
    asked = [];
    await expect(
      resolveInitAnswers(
        {
          name: "billing",
          dir: "./apps/billing",
          public: "./api/public",
          service: "api/service",
        },
        ask,
      ),
    ).resolves.toEqual({
      name: "billing",
      directory: "./apps/billing",
      publicDir: "api/public",
      serviceDir: "api/service",
    });
    expect(asked).toEqual([]);
  });

  it("prompts for missing answers and uses the defaults", async () => {
    asked = [];
    answers = ["", "notes", "", ""];
    await expect(resolveInitAnswers({}, ask)).resolves.toEqual({
      name: "my-app",
      directory: "notes",
      publicDir: "src/public",
      serviceDir: "src/service",
    });
    expect(asked.map((item) => item[1])).toEqual([
      "my-app",
      "./my-app",
      "./src/public",
      "./src/service",
    ]);
  });

  it("rejects a name or route folder that cannot be created safely", async () => {
    await expect(
      resolveInitAnswers({ name: "../billing" }, ask),
    ).rejects.toThrow(
      "Project name must use letters, numbers, dots, hyphens, or underscores.",
    );
    await expect(
      resolveInitAnswers({ name: "billing", public: "../secret" }, ask),
    ).rejects.toThrow(
      "Public server folder must be a path inside the project.",
    );
  });
});

describe("createProject", () => {
  it("requires git before it writes a project", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "keja-init-"));
    const calls: string[] = [];
    await expect(
      createProject({
        answers: {
          name: "my-app",
          directory: "./my-app",
          publicDir: "src/public",
          serviceDir: "src/service",
        },
        cwd: root,
        templateDir: path.join(root, "template"),
        packageRoot: path.join(root, "keja"),
        run: async (command, args) => {
          calls.push(`${command} ${args.join(" ")}`);
          return 1;
        },
      }),
    ).rejects.toThrow("Git is required to create a project.");
    expect(calls).toEqual(["git --version"]);
  });

  it("copies the starter, rewrites the project files, and initializes git", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "keja-init-"));
    const templateDir = path.join(root, "template");
    const packageRoot = path.join(root, "keja");
    mkdirSync(templateDir, { recursive: true });
    mkdirSync(packageRoot, { recursive: true });
    mkdirSync(path.join(templateDir, "node_modules", "left-behind"), {
      recursive: true,
    });
    writeFileSync(
      path.join(templateDir, "keja.versioning.ts"),
      "export default 1;\n",
    );
    writeFileSync(path.join(templateDir, ".env.example"), "HOST=127.0.0.1\n");
    writeFileSync(path.join(templateDir, "package.json"), "{}\n");
    writeFileSync(
      path.join(packageRoot, "package.json"),
      JSON.stringify({ version: "0.1.0" }),
    );
    writeFileSync(
      path.join(templateDir, "node_modules", "left-behind", "skip.txt"),
      "nope",
    );
    const calls: string[] = [];
    const directory = await createProject({
      answers: {
        name: "notes",
        directory: "./notes",
        publicDir: "routes/public",
        serviceDir: "routes/service",
      },
      cwd: root,
      templateDir,
      packageRoot,
      run: async (command, args, cwd) => {
        calls.push(`${command} ${args.join(" ")} ${cwd}`);
        return 0;
      },
    });

    expect(directory).toBe(path.resolve(root, "notes"));
    expect(calls.map((call) => call.slice(0, call.lastIndexOf(" ")))).toEqual([
      "git --version",
      "git init",
    ]);
    expect(
      readFileSync(path.join(directory, "keja.versioning.ts"), "utf8"),
    ).toBe("export default 1;\n");
    expect(readFileSync(path.join(directory, ".env"), "utf8")).toBe(
      "HOST=127.0.0.1\n",
    );
    expect(readFileSync(path.join(directory, ".env.example"), "utf8")).toBe(
      "HOST=127.0.0.1\n",
    );
    expect(
      readFileSync(path.join(directory, "package.json"), "utf8"),
    ).toContain('"name": "notes"');
    expect(
      readFileSync(path.join(directory, "package.json"), "utf8"),
    ).toContain('"@veducio/keja": "^0.1.0"');
    expect(readFileSync(path.join(directory, ".npmrc"), "utf8")).toBe(
      "@veducio:registry=https://npm.pkg.github.com\n",
    );
    expect(
      readFileSync(path.join(directory, "keja.config.ts"), "utf8"),
    ).toContain('public: "routes/public"');
    expect(
      readFileSync(path.join(directory, "keja.config.ts"), "utf8"),
    ).toContain('service: "routes/service"');
    expect(
      readFileSync(path.join(directory, "tsconfig.json"), "utf8"),
    ).not.toContain("paths");
    expect(
      readFileSync(path.join(directory, "routes/public/hello.ts"), "utf8"),
    ).toContain('path: "/hello"');
    expect(
      readFileSync(
        path.join(directory, "routes/public/_middleware.ts"),
        "utf8",
      ),
    ).toContain("defineMiddleware");
    expect(
      readFileSync(path.join(directory, "routes/service/ping.ts"), "utf8"),
    ).toContain('method: "post"');
    expect(() =>
      readFileSync(path.join(directory, "node_modules/left-behind/skip.txt")),
    ).toThrow();
  });

  it("stops when the destination already has files", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "keja-init-"));
    mkdirSync(path.join(root, "notes"));
    writeFileSync(path.join(root, "notes", "kept.txt"), "keep");
    await expect(
      createProject({
        answers: {
          name: "notes",
          directory: "./notes",
          publicDir: "src/public",
          serviceDir: "src/service",
        },
        cwd: root,
        templateDir: path.join(root, "template"),
        packageRoot: path.join(root, "keja"),
        run: async () => 0,
      }),
    ).rejects.toThrow("already exists and is not empty");
  });
});

describe("runInit", () => {
  it("uses defaults when the terminal is not interactive", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "keja-init-"));
    const templateDir = path.join(root, "template");
    const packageRoot = path.join(root, "keja");
    mkdirSync(templateDir, { recursive: true });
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(
      path.join(packageRoot, "package.json"),
      JSON.stringify({ version: "0.1.0" }),
    );
    writeFileSync(
      path.join(templateDir, "keja.versioning.ts"),
      "export default 1;\n",
    );
    const lines: string[] = [];
    const directory = await runInit({
      input: {},
      cwd: root,
      templateDir,
      packageRoot,
      interactive: false,
      ask,
      run: async () => 0,
      log(message) {
        lines.push(message);
      },
    });
    expect(directory).toBe(path.resolve(root, "my-app"));
    expect(lines.join("\n")).toContain("Created my-app");
    expect(
      readFileSync(path.join(directory, "src/public/hello.ts"), "utf8"),
    ).toContain('path: "/hello"');
  });
});
