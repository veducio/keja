---

title: Responses
description: Named respond helpers and constant response fields.
---

A handler returns `respond.Name(...)`. It does not build the HTTP response itself. Each name is a status code and a Zod schema, so the body has to match what the route declared.

Each name in `responses` becomes `respond.Name` in the handler. `response` sets the status code and the Zod schema. The handler returns that function's result.

```ts
responses: {
  Created: response({
    code: 201,
    json: z.object({ id: z.string(), name: z.string() }),
  }),
},
handler: ({ body, respond }) => respond.Created({ id: "1", name: body.name }),
```

The status code is an integer from `100` to `599`. Anything else is project error `2010`. A value that fails the schema returns HTTP `500` and framework error `1004`, including the Zod issues.

## Constant fields

`const` lists fields the handler does not pass. Keja merges them onto the body, and those values win when the handler also sends them. The schema still has to accept the merged object. A response whose every field is constant is a function with no arguments.

```ts
Gone: response({
  code: 410,
  json: z.object({ error: z.literal("GONE") }),
  const: { error: "GONE" },
}),
handler: ({ respond }) => respond.Gone(),
```
