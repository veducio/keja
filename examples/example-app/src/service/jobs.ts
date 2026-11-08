import { defineRoute, response } from "@veducio/keja";
import { z } from "zod";

const jobs: { id: string; name: string }[] = [];

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
  handler: ({ body, respond }) => {
    const job = { id: crypto.randomUUID(), name: body.name };
    jobs.push(job);
    return respond.Created(job);
  },
});
