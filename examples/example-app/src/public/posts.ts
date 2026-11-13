import { createObjectRow, defineRoute, response } from "@veducio/keja";
import { z } from "zod";
import { posts } from "../db/repositories.ts";
import { exampleTenant } from "../tenant.ts";

export const _Get = defineRoute({
  method: "get",
  path: "/posts",
  version: "v1",
  request: {
    query: posts.list.schema,
  },
  responses: {
    Posts: response({
      code: 200,
      json: z.object({
        posts: z.array(posts.meta),
        nextCursor: z.string().nullable(),
      }),
    }),
  },
  handler: async ({ query, respond }) => {
    const page = await posts.list(query, { tenant: exampleTenant });
    return respond.Posts({
      posts: page.items,
      nextCursor: page.nextCursor,
    });
  },
});

export const _Post = defineRoute({
  method: "post",
  path: "/posts",
  version: "v1",
  request: {
    body: posts.schema,
  },
  responses: {
    Post: response({
      code: 201,
      json: posts.meta,
    }),
  },
  handler: async ({ body, respond }) => {
    const post = await posts.insert({
      ...createObjectRow("v1.posts", { tenant: exampleTenant }),
      ...body,
    });
    return respond.Post({
      ...post,
    });
  },
});

export const _ArchiveById = defineRoute({
  method: "post",
  path: "/posts/:id/archive",
  version: "v1",
  name: "Archive a post by Id",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    Empty: response({
      code: 200,
      json: z.object({}),
    }),
    Archived: response({
      code: 200,
      json: z.object({ message: z.literal("Archived") }),
      const: { message: "Archived" },
    }),
    NotFound: response({
      code: 404,
      json: z.object({
        id: z.string(),
        error: z.literal("ID_DOES_NOT_EXIST"),
      }),
      const: { error: "ID_DOES_NOT_EXIST" },
    }),
  },
  handler: async ({ params, respond }) => {
    const found = await posts.find(params.id, { tenant: exampleTenant });
    if (!found) {
      return respond.NotFound({
        id: params.id,
      });
    }
    await posts.archive(params.id, exampleTenant);
    return respond.Archived();
  },
});
