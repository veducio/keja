---

title: TypeIDs
description: Time-ordered ids stored on OwnedObjects rows.
---

A TypeID is the `_id` of an [OwnedObjects](/owned-objects) row. The suffix is time-ordered, so a row created later sorts after a row created earlier, and Postgres can append new ids in an index.

A TypeID is a lowercase prefix, an underscore, and 26 Crockford base32 characters. The suffix encodes a UUIDv7, so values created later sort after values created earlier. Postgres can append them in a B-tree.

```txt
user_01h455vb4pex5vsknk084sn02q
```

The prefix starts and ends with a letter, contains only `a-z` and `_`, and is at most 63 characters. `TypeIdError` is thrown for a bad prefix, route, or object type.

```ts
import {
  createObjectRow,
  createTypeId,
  isTypeId,
  objectTypeFromRoute,
  parseTypeId,
} from "@veducio/keja";

const objectType = objectTypeFromRoute(2, "/core/users");
const row = createObjectRow(objectType, { tenant: "tenant_1" });
```

`objectType` is `v2.core.users`. The row is an [OwnedObjects](/owned-objects) record: `_id`, `_object`, `_tenant`, `_archived: false`, `_createdAt`, and `_updatedAt`. The id prefix defaults to the last segment, `users`. Pass `idPrefix` to override it.

`objectTypeFromRoute` requires a version integer of at least `1` and a path whose segments are valid TypeID prefixes. A parameter such as `:id` is rejected.

`assertObjectType` and `isObjectType` check a string of the form `vN.segment` with one or more segments. `idPrefixFromObjectType` returns the last segment. `parseTypeId` returns `{ prefix, suffix }` or `null`. `isTypeId(value, prefix)` checks one prefix.

`assertOwnedObject` checks a full stored row, including domain columns.
