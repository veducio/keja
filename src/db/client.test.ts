import { describe, expect, it } from "vitest";
import { DBCall, setDatabase } from "./client.ts";

describe("DBCall", () => {
  it("forwards queries to the connected client", async () => {
    const calls: unknown[][] = [];
    const client = Object.assign(
      (...args: unknown[]) => {
        calls.push(args);
        return ["ok"];
      },
      {
        close() {
          return "closed";
        },
      },
    );
    setDatabase(client as never);
    try {
      expect(await DBCall`select 1`).toEqual(["ok"]);
      expect(calls).toHaveLength(1);
      expect(DBCall.close()).toBe("closed");
    } finally {
      setDatabase(null);
    }
  });

  it("rejects an insert that is not an owned object", async () => {
    const calls: unknown[][] = [];
    setDatabase(((...args: unknown[]) => {
      calls.push(args);
      return [];
    }) as never);
    try {
      expect(() => DBCall`insert into notes ${{ message: "hi" }}`).toThrow(
        "OwnedObjects _id must be a typeid",
      );
      expect(calls).toHaveLength(0);
      expect(await DBCall`select * from notes`).toEqual([]);
    } finally {
      setDatabase(null);
    }
  });

  it("fails when the database is disabled", () => {
    setDatabase(null);
    expect(() => DBCall`select 1`).toThrow("DBCall requires db");
  });
});
