import { defineMiddleware, defineRoute, response } from "@veducio/keja";
import { z } from "zod";
import { users } from "../db/repositories.ts";
import { exampleTenant } from "../tenant.ts";

const withPlan = defineMiddleware(async ({ next }) => {
  const response = await next({ plan: "public" });
  response.headers.set("x-route", "users");
  return response;
});

const user = z.object({
  id: z.string(),
  name: z.string(),
});

export default defineRoute({
  method: "get",
  path: "/users/:id",
  version: "v1",
  request: {
    params: users.get.params,
    query: users.get.query,
  },
  middleware: [withPlan],
  responses: {
    User: response({ code: 200, json: user }),
    IdDoesNotExist: response({
      code: 404,
      json: z.object({
        id: z.string(),
        error: z.literal("ID_DOES_NOT_EXIST"),
      }),
      const: { error: "ID_DOES_NOT_EXIST" },
    }),
  },
  handler: async ({ params, query, plan, respond }) => {
    const found = await users.get(params, query, { tenant: exampleTenant });
    if (!found) {
      return respond.IdDoesNotExist(params);
    }
    const result = respond.User({ id: found._id, name: found.name });
    result.headers.set("x-plan", plan);
    return result;
  },
});
