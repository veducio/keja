---

title: Responses
description: response() helpers and respond.Name in handlers.
---

Handlers return `respond.Name(...)`. Each key in `responses` becomes a helper with a fixed status code and Zod schema.

## `response`

```ts
responses: {
  Created: response({
    code: 201,
    json: z.object({ id: z.string(), name: z.string() }),
  }),
},
handler: ({ body, respond }) => respond.Created({ id: "1", name: body.name }),
```

| Field   | Required | Description                                    |
| ------- | -------- | ---------------------------------------------- |
| `code`  | yes      | Integer status `100`–`599` (`2010` if outside) |
| `json`  | yes      | Zod schema for the JSON body                   |
| `const` | no       | Fields merged onto the body; win over handler  |

If the handler result fails the schema, Keja returns HTTP `500` and framework error `1004` (includes Zod issues).

## Constant-only bodies

When every field is in `const`, the helper takes no arguments:

```ts
Gone: response({
  code: 410,
  json: z.object({ error: z.literal("GONE") }),
  const: { error: "GONE" },
}),
handler: ({ respond }) => respond.Gone(),
```
