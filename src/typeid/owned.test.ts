import { describe, expect, it } from "vitest";
import { createTypeId } from "./id.ts";
import { assertOwnedCall, assertOwnedObject } from "./owned.ts";

const now = new Date("2026-01-01T00:00:00.000Z");
const row = {
  _id: createTypeId("user"),
  _object: "v2.user",
  _tenant: "tenant_1",
  _archived: false,
  _createdAt: now,
  _updatedAt: now,
  actor_id: "232532fsarrw23",
  active: true,
  message: "wewesraewe wew eas",
};

describe("assertOwnedObject", () => {
  it("accepts reserved fields plus domain columns", () => {
    expect(assertOwnedObject(row)).toEqual(row);
  });

  it("rejects a reserved field that is not part of OwnedObjects", () => {
    expect(() => assertOwnedObject({ ...row, _secret: "no" })).toThrow(
      "OwnedObjects field _secret is reserved",
    );
    expect(() => assertOwnedObject({ ...row, _id: "user_short" })).toThrow(
      "OwnedObjects _id must be a typeid",
    );
    expect(() =>
      assertOwnedObject({
        ...row,
        _updatedAt: new Date("2025-01-01T00:00:00.000Z"),
      }),
    ).toThrow("OwnedObjects _updatedAt must be at or after _createdAt");
  });
});

describe("assertOwnedCall", () => {
  it("requires an insert to carry OwnedObjects", () => {
    expect(() =>
      assertOwnedCall("insert into notes (message) values ($1)", ["hi"]),
    ).toThrow("insert must include _id");
    expect(() =>
      assertOwnedCall("insert into notes ", [{ message: "hi" }]),
    ).toThrow("OwnedObjects _id must be a typeid");
    expect(() => assertOwnedCall("insert into notes ", [row])).not.toThrow();
    expect(() =>
      assertOwnedCall("insert into notes ", [new InsertHelper([row])]),
    ).not.toThrow();
    expect(() =>
      assertOwnedCall("insert into notes ", [
        new InsertHelper([{ message: "hi" }]),
      ]),
    ).toThrow("OwnedObjects _id must be a typeid");
  });

  it("checks OwnedObjects fields on update and ignores reads", () => {
    expect(() =>
      assertOwnedCall("update notes set message = $1", [{ message: "next" }]),
    ).not.toThrow();
    expect(() =>
      assertOwnedCall("update notes set _archived = $1", [
        { _archived: "yes" },
      ]),
    ).toThrow("OwnedObjects _archived must be a boolean");
    expect(() => assertOwnedCall("select * from notes", [])).not.toThrow();
  });
});

class InsertHelper {
  constructor(readonly value: readonly Record<string, unknown>[]) {}
}
