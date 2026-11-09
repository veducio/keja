import { defineSeeder } from "@veducio/keja";

const at = new Date("2026-01-15T00:00:00.000Z");
const tenant = "tenant_01m6zveeraf6bv534bx7rw7gr0";

export default defineSeeder({
  table: "users",
  objects: [
    {
      _id: "users_01m6zveercf6bv534p739cb62s",
      _object: "v1.users",
      _tenant: tenant,
      _archived: false,
      _createdAt: at,
      _updatedAt: at,
      name: "Ada Lovelace",
      email: "ada@example.com",
    },
    {
      _id: "users_01m6zveercf6bv534yxrtgenj3",
      _object: "v1.users",
      _tenant: tenant,
      _archived: false,
      _createdAt: at,
      _updatedAt: at,
      name: "Alan Turing",
      email: "alan@example.com",
    },
  ],
});
