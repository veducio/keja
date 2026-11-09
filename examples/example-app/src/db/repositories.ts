import { repository } from "@veducio/keja";

export const jobs = repository({
  table: "jobs",
  columns: {
    name: { type: "text", nullable: false },
  } as const,
});

export const posts = repository({
  table: "posts",
  columns: {
    title: { type: "text", nullable: false },
    author_id: { type: "text", nullable: false },
  } as const,
  list: true,
});

export const users = repository({
  table: "users",
  columns: {
    name: { type: "text", nullable: false },
    email: { type: "text", nullable: false },
  } as const,
  list: true,
  get: true,
});
