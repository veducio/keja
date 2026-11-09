import { describe, expect, it } from "vitest";
import {
  createObjectRow,
  createTypeId,
  idPrefixFromObjectType,
  isObjectType,
  isTypeId,
  objectTypeFromRoute,
  parseTypeId,
} from "./id.ts";

describe("typeids", () => {
  it("creates a prefixed typeid and reads it back", () => {
    const id = createTypeId("user");
    expect(isTypeId(id, "user")).toBe(true);
    expect(parseTypeId(id)).toEqual({
      prefix: "user",
      suffix: id.slice("user_".length),
    });
    expect(id.slice("user_".length)).toHaveLength(26);
    expect(parseTypeId("User_abc")).toBeNull();
    expect(() => createTypeId("User")).toThrow("invalid type prefix: User");
  });

  it("derives an object type from a route and builds an OwnedObjects row", () => {
    expect(objectTypeFromRoute(2, "/core/users")).toBe("v2.core.users");
    expect(idPrefixFromObjectType("v2.core.users")).toBe("users");
    expect(isObjectType("v2.core.users")).toBe(true);
    expect(isObjectType("users")).toBe(false);
    const row = createObjectRow("v2.core.users", { tenant: "acme" });
    expect(row._object).toBe("v2.core.users");
    expect(row._tenant).toBe("acme");
    expect(row._archived).toBe(false);
    expect(row._createdAt).toEqual(row._updatedAt);
    expect(isTypeId(row._id, "users")).toBe(true);
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
