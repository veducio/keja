---

title: TypeIDs
description: TypeID format and helpers for OwnedObjects ids.
---

A TypeID is the usual `_id` on an OwnedObjects row: lowercase prefix, underscore, 26 Crockford base32 characters encoding a UUIDv7.

```txt
user_01h455vb4pex5vsknk084sn02q
```

## Prefix rules

- Starts and ends with a letter
- Only `a-z` and `_`
- At most 63 characters

Bad prefix, route, or object type → `TypeIdError`.

## Helpers

```ts
import {
  assertObjectType,
  assertOwnedObject,
  createObjectRow,
  createTypeId,
  idPrefixFromObjectType,
  isObjectType,
  isTypeId,
  objectTypeFromRoute,
  parseTypeId,
} from "@veducio/keja";

const objectType = objectTypeFromRoute(2, "/core/users");
const row = createObjectRow(objectType, { tenant: "tenant_1" });
```

| Function                             | Role                                                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `createTypeId`                       | Build a TypeID                                                                                           |
| `parseTypeId`                        | `{ prefix, suffix }` or `null`                                                                           |
| `isTypeId(value, prefix?)`           | Validate                                                                                                 |
| `objectTypeFromRoute(version, path)` | `vN.seg...`; version ≥ 1; path segments are prefixes; no `:params`                                       |
| `createObjectRow`                    | OwnedObjects envelope (`_id`, `_object`, `_tenant`, `_archived: false`, timestamps); optional `idPrefix` |
| `assertObjectType` / `isObjectType`  | `vN.segment`…                                                                                            |
| `idPrefixFromObjectType`             | Last segment                                                                                             |
| `assertOwnedObject`                  | Full stored row including domain keys                                                                    |
