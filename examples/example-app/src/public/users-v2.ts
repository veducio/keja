import { defineRoute, response } from "@veducio/keja";
import { z } from "zod";
import { users } from "../data.ts";

export default defineRoute({
  method: "get",
  path: "/users/:id",
  version: "v2",
  request: {
    params: z.object({ id: z.string().min(1) }),
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
  handler: ({ params, respond }) => {
    const found = users.find((item) => item.id === params.id);
    if (!found) {
      return respond.IdDoesNotExist(params);
    }
    return respond.User(found);
  },
});
