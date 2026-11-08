import type { SQL } from "bun";
import { assertOwnedCall } from "../object-id/owned.ts";

let current: SQL | null = null;

function connected() {
  if (!current) {
    throw new Error("Database is disabled");
  }
  return current;
}

export const DBCall = new Proxy(function DBCall() {}, {
  apply(_target, _thisArg, args) {
    const client = connected();
    const text = templateText(args[0]);
    if (text !== null) {
      assertOwnedCall(text, args.slice(1));
    }
    return Reflect.apply(
      client as unknown as (...values: unknown[]) => unknown,
      client,
      args,
    );
  },
  get(_target, property) {
    const client = connected();
    const value = Reflect.get(client, property, client);
    if (property === "unsafe" && typeof value === "function") {
      return (statement: unknown, ...rest: unknown[]) => {
        if (typeof statement === "string") {
          assertOwnedCall(statement, []);
        }
        return value.call(client, statement, ...rest);
      };
    }
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as unknown as SQL;

export function setDatabase(client: SQL | null) {
  current = client;
}

function templateText(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const strings = Array.from(value as ArrayLike<unknown>);
  if (
    strings.length === 0 ||
    strings.some((part) => typeof part !== "string")
  ) {
    return null;
  }
  return strings.join(" ");
}
