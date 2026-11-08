# Keja 0.1.0

Keja should be a wrapper around hono framework powered by bun Fully Typesafe

Keja should Expose 2 http servers

- Public (HTTP_PORT)
- Service (HTTP_SERVICE_PORT)

Both of these servers should have separate routes in created with the keja project structure (So we run 2 Hono Fetch Handlers)

Keja APIs should be versioned in the following rules:

- every project should contain in root folder keja.versioning.ts
  This file should contain Definitions of versioning by v1, v2, v3, ...
  These versions should also contain their release date in YYYY-MM-DD format, DD-MM-YYYY format or Unix Timestamp
  Clients should be able to call http://SERVICE/v1/ or http://SERVICE/2020-09-20/ then we should match latest version BEFORE the pinned date
  Server should also accept keyword like latest, LATEST, CURRENT, current
- The api definitions in project should be code-first defined where we define possible responses and request structure with zod and then
  we are able to call them as a return function with IF DEFINED parameters to the response these responses could be a import from handler definition constructor
- Each handler should have a defined version so that if the api has v1 and v2 versions and specific path has only defined v1 even if specified v2 we use the v1 handler (latest avaiable)
- Each of the http servers should have expose a RESERVED routes:
  - /_health
  - /_openapi.json - return a openapi 3 document with whole api info
  - /docs - returns scalar UI based on data from /_openapi.json
