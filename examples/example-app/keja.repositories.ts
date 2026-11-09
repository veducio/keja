import { defineRepositories } from "@veducio/keja";

export default defineRepositories({
  users: { list: true, get: true },
  posts: { list: true },
});
