import { defineRoute, response } from "@veducio/keja";
import { z } from "zod";
import { posts } from "../data.ts";

export default defineRoute({
  method: "get",
  path: "/posts",
  version: "v12",
  responses: {
    Posts: response({
      code: 200,
      json: z.object({
        posts: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            authorId: z.string(),
          }),
        ),
      }),
    }),
  },
  handler: ({ respond }) => respond.Posts({ posts }),
});
