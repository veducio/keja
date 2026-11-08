import { describe, expect, it } from "vitest";
import { assertOwnedCall, assertOwnedObject } from "./owned.ts";

const row = {
  _id: "user_aaaaaaaaaaaaaaaaaaaaa",
  _object: "v2.user",
  _tenant: "tenant_1",
  _archived: false,
  actor_id: "232532fsarrw23",
  active: true,
  message: "wewesraewe wew eas",
};

describe("assertOwnedObject", () => {
  it("accepts reserved fields plus domain columns", () => {
    expect(assertOwnedObject(row)).toEqual(row);
  });

  it("rejects a reserved field that is not part of the owned object", () => {
    expect(() => assertOwnedObject({ ...row, _secret: "no" })).toThrow(
      "owned object field _secret is reserved",
    );
    expect(() => assertOwnedObject({ ...row, _id: "user_short" })).toThrow(
      "owned object _id must be an object id",
    );
  });
});

describe("assertOwnedCall", () => {
  it("requires an insert to carry the owned object", () => {
    expect(() =>
      assertOwnedCall("insert into notes (message) values ($1)", ["hi"]),
    ).toThrow("insert must include _id");
    expect(() =>
      assertOwnedCall("insert into notes ", [{ message: "hi" }]),
    ).toThrow("owned object _id must be an object id");
    expect(() => assertOwnedCall("insert into notes ", [row])).not.toThrow();
  });

  it("checks owned fields on update and ignores reads", () => {
    expect(() =>
      assertOwnedCall("update notes set message = $1", [{ message: "next" }]),
    ).not.toThrow();
    expect(() =>
      assertOwnedCall("update notes set _archived = $1", [
        { _archived: "yes" },
      ]),
    ).toThrow("owned object _archived must be a boolean");
    expect(() => assertOwnedCall("select * from notes", [])).not.toThrow();
  });
});
