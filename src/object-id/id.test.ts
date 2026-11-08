import { describe, expect, it } from "vitest";
import {
  createId,
  createObjectRow,
  idPrefixFromObjectType,
  isObjectId,
  isObjectType,
  OBJECT_ID_BODY_LENGTH,
  objectTypeFromRoute,
  parseObjectId,
} from "./id.ts";

describe("object ids", () => {
  it("creates a prefixed id and reads it back", () => {
    const id = createId("user");
    expect(isObjectId(id, "user")).toBe(true);
    expect(parseObjectId(id)).toEqual({
      prefix: "user",
      body: id.slice("user_".length),
    });
    expect(id.slice("user_".length)).toHaveLength(OBJECT_ID_BODY_LENGTH);
    expect(parseObjectId("User_abc")).toBeNull();
    expect(() => createId("User")).toThrow("invalid id prefix: User");
  });

  it("derives an object type from a route and builds a row", () => {
    expect(objectTypeFromRoute(2, "/core/users")).toBe("v2.core.users");
    expect(idPrefixFromObjectType("v2.core.users")).toBe("users");
    expect(isObjectType("v2.core.users")).toBe(true);
    expect(isObjectType("users")).toBe(false);
    const row = createObjectRow("v2.core.users", { tenant: "acme" });
    expect(row).toMatchObject({
      _object: "v2.core.users",
      _tenant: "acme",
      _archived: false,
    });
    expect(isObjectId(row._id, "users")).toBe(true);
  });

  it("rejects a route that cannot become an object type", () => {
    expect(() => objectTypeFromRoute(0, "/users")).toThrow(
      "invalid API version: 0",
    );
    expect(() => objectTypeFromRoute(1, "/users/:id")).toThrow(
      'invalid route segment ":id" in /users/:id',
    );
  });
});
