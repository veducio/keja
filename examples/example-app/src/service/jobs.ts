import { createObjectRow, defineRoute, response } from "@veducio/keja";
import { z } from "zod";
import { jobs } from "../db/repositories.ts";
import { exampleTenant } from "../tenant.ts";

export default defineRoute({
  method: "post",
  path: "/jobs",
  version: "v2",
  request: {
    body: z.object({ name: z.string().min(1) }),
  },
  responses: {
    Created: response({
      code: 201,
      json: z.object({
        id: z.string(),
        name: z.string(),
      }),
    }),
  },
  handler: async ({ body, respond }) => {
    const saved = await jobs.insert({
      ...createObjectRow("v2.jobs", { tenant: exampleTenant }),
      name: body.name,
    });
    return respond.Created({ id: saved._id, name: saved.name });
  },
});
