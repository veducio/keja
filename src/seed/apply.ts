import { DBCall } from "../db/client.ts";
import type { Seeder } from "./define.ts";

export async function applySeeder(seeder: Seeder) {
  const inserted = await DBCall`
    insert into ${DBCall(seeder.table)} ${DBCall(seeder.objects)}
    on conflict (_id) do nothing
    returning _id
  `;
  return Array.isArray(inserted) ? inserted.length : 0;
}
