import { defineSeeder } from "@veducio/keja";

const at = new Date("2026-01-15T00:00:00.000Z");
const tenant = "tenant_01m6zveeraf6bv534bx7rw7gr0";

export default defineSeeder({
  table: "posts",
  objects: [
    {
      _id: "posts_01m6zveercf6bv5350ee9nvzd2",
      _object: "v1.posts",
      _tenant: tenant,
      _archived: false,
      _createdAt: at,
      _updatedAt: at,
      title: "Versioned routes",
      author_id: "users_01m6zveercf6bv534p739cb62s",
    },
    {
      _id: "posts_01m6zveercf6bv5359f3w0cw0e",
      _object: "v1.posts",
      _tenant: tenant,
      _archived: false,
      _createdAt: at,
      _updatedAt: at,
      title: "Two servers",
      author_id: "users_01m6zveercf6bv534yxrtgenj3",
    },
    {
      _id: "posts_01m6zveercf6bv5359f3w0cw0f",
      _object: "v1.posts",
      _tenant: tenant,
      _archived: false,
      _createdAt: at,
      _updatedAt: at,
      title: "Three servers",
      author_id: "users_01m6zveercf6bv534yxrtgenj3",
    },
  ],
});
