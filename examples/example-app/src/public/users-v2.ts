import { defineRoute, response } from "@veducio/keja";
import { z } from "zod";
import { users } from "../db/repositories.ts";
import { exampleTenant } from "../tenant.ts";

export default defineRoute({
  method: "get",
  path: "/users/:id",
  version: "v2",
  request: {
    params: users.get.params,
    query: users.get.query,
  },
  responses: {
    User: response({
      code: 200,
      json: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
      }),
    }),
    IdDoesNotExist: response({
      code: 404,
      json: z.object({
        id: z.string(),
        error: z.literal("ID_DOES_NOT_EXIST"),
      }),
      const: { error: "ID_DOES_NOT_EXIST" },
    }),
  },
  handler: async ({ params, query, respond }) => {
    const found = await users.get(params, query, { tenant: exampleTenant });
    if (!found) {
      return respond.IdDoesNotExist(params);
    }
    return respond.User({
      id: found._id,
      name: found.name,
      email: found.email,
    });
  },
});
