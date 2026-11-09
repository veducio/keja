import { Chalk } from "chalk";
import { describe, expect, it } from "vitest";
import { formatSeed } from "./report.ts";

describe("formatSeed", () => {
  it("lists inserted rows and an empty seed folder", () => {
    expect(formatSeed([{ table: "users", inserted: 2 }])).toBe(
      "\n  SEED\n\n  - users      2\n",
    );
    expect(formatSeed([])).toBe("\n  SEED\n\n  - Seeders    none\n");
    const style = new Chalk({ level: 1 });
    expect(formatSeed([{ table: "users", inserted: 2 }], true)).toContain(
      style.dim("SEED"),
    );
  });
});
