import { Chalk } from "chalk";
import { describe, expect, it } from "vitest";
import { projectError } from "../errors/framework-errors.ts";
import {
  formatProjectFailure,
  formatUnknownFailure,
  readProjectFailure,
} from "./run-project.ts";

const unknownVersion = readProjectFailure(
  projectError("unknownRouteVersion", "GET /posts uses unknown version v12"),
);

describe("formatUnknownFailure", () => {
  it("prints nested build messages with file location and source", () => {
    const failure = Object.assign(
      new AggregateError(
        [
          Object.assign(new Error('Expected identifier but found ")"'), {
            position: {
              file: "C:\\app\\src\\public\\PassLogin.ts",
              line: 40,
              column: 54,
              lineText:
                "          type: z.enum(user_restrictions.schema.type.),",
            },
          }),
        ],
        '6 errors building "PassLogin.ts"',
      ),
      {
        errors: [
          Object.assign(new Error('Expected identifier but found ")"'), {
            position: {
              file: "C:\\app\\src\\public\\PassLogin.ts",
              line: 40,
              column: 54,
              lineText:
                "          type: z.enum(user_restrictions.schema.type.),",
            },
          }),
        ],
      },
    );
    expect(formatUnknownFailure(failure)).toBe(
      [
        '6 errors building "PassLogin.ts"',
        'Expected identifier but found ")"',
        "at C:\\app\\src\\public\\PassLogin.ts:40:54",
        "          type: z.enum(user_restrictions.schema.type.),",
        `${" ".repeat(53)}^`,
      ].join("\n"),
    );
  });
});

describe("formatProjectFailure", () => {
  it("prints the scope, code, and name, then waits in dev", () => {
    expect(formatProjectFailure(unknownVersion, { wait: true })).toBe(
      [
        "",
        "   ERROR  Project  2001 UnknownRouteVersion",
        "    GET /posts uses unknown version v12",
        "    A route uses a version this project does not define.",
        "    Add the version to keja.versioning.ts, or change the route version.",
        "",
        "  waiting for changes",
        "",
      ].join("\n"),
    );
  });

  it("prints the project error without waiting for start", () => {
    expect(formatProjectFailure(unknownVersion, { wait: false })).toBe(
      [
        "",
        "   ERROR  Project  2001 UnknownRouteVersion",
        "    GET /posts uses unknown version v12",
        "    A route uses a version this project does not define.",
        "    Add the version to keja.versioning.ts, or change the route version.",
        "",
      ].join("\n"),
    );
  });

  it("colors the badge, scope, code, and name", () => {
    const style = new Chalk({ level: 1 });
    const printed = formatProjectFailure(unknownVersion, {
      wait: true,
      color: true,
    });
    expect(printed).toContain(style.bgRed.white.bold(" ERROR "));
    expect(printed).toContain(style.bold("Project"));
    expect(printed).toContain(style.dim("2001"));
    expect(printed).toContain(style.bold("UnknownRouteVersion"));
  });
});
