import { defineMiddleware } from "@veducio/keja";

export default defineMiddleware(async ({ next }) => {
  const response = await next();
  response.headers.set("x-keja", "public");
  return response;
});
