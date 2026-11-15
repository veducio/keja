import { describe, expect, it } from "vitest";
import { confirmSeed, confirmSeedMessage } from "./confirm.ts";

describe("confirmSeed", () => {
  it("names the tables that will be cleared", () => {
    expect(confirmSeedMessage(["users", "notes", "users"])).toBe(
      "This will clear users, notes and insert seed data. Continue?",
    );
  });

  it("accepts --yes without asking", async () => {
    let asked = false;
    await expect(
      confirmSeed({
        yes: true,
        interactive: true,
        tables: ["users"],
        ask: async () => {
          asked = true;
          return "n";
        },
      }),
    ).resolves.toBe("yes");
    expect(asked).toBe(false);
  });

  it("requires --yes when there is no terminal", async () => {
    await expect(
      confirmSeed({
        yes: false,
        interactive: false,
        tables: ["users"],
        ask: async () => "y",
      }),
    ).resolves.toBe("needs-yes");
  });

  it("accepts y or yes from the prompt", async () => {
    await expect(
      confirmSeed({
        yes: false,
        interactive: true,
        tables: ["users"],
        ask: async () => " Y ",
      }),
    ).resolves.toBe("yes");
    await expect(
      confirmSeed({
        yes: false,
        interactive: true,
        tables: ["users"],
        ask: async () => "no",
      }),
    ).resolves.toBe("no");
  });
});
