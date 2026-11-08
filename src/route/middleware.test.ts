import { describe, expect, it } from "vitest";
import {
  defineMiddleware,
  middlewareList,
  runMiddleware,
} from "./middleware.ts";

const context = {
  request: new Request("http://127.0.0.1/v1/items/ada"),
  version: "v1",
  params: { id: "ada" },
};

describe("middlewareList", () => {
  it("accepts one middleware or a list of them", () => {
    const step = defineMiddleware(async ({ next }) => next());
    expect(middlewareList(step)).toEqual([step]);
    expect(middlewareList([step, step])).toEqual([step, step]);
    expect(middlewareList({})).toBeNull();
  });
});

describe("runMiddleware", () => {
  it("rejects a second next() call", async () => {
    const step = defineMiddleware(async ({ next }) => {
      await next();
      return next();
    });
    await expect(
      runMiddleware(
        [{ definition: step, allowFields: true }],
        context,
        () => new Response(),
      ),
    ).rejects.toThrow("next() was already called");
  });

  it("rejects values passed by server middleware", async () => {
    const step = defineMiddleware(async ({ next }) => next({ user: "ada" }));
    await expect(
      runMiddleware(
        [{ definition: step, allowFields: false }],
        context,
        () => new Response(),
      ),
    ).rejects.toThrow("Server middleware cannot pass values to next()");
  });

  it("rejects handler fields named params, query, body, or respond", async () => {
    for (const key of ["params", "query", "body", "respond"] as const) {
      const step = defineMiddleware(async ({ next }) =>
        next({ [key]: true } as never),
      );
      await expect(
        runMiddleware(
          [{ definition: step, allowFields: true }],
          context,
          () => new Response(),
        ),
      ).rejects.toThrow(`Middleware cannot pass reserved field ${key}`);
    }
  });
});
