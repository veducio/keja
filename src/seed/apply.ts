import { DBCall } from "../db/client.ts";
import type { Seeder } from "./define.ts";

export async function truncateSeedTables(tables: readonly string[]) {
  const unique = [...new Set(tables)];
  if (unique.length === 0) {
    return;
  }
  const list = unique.map((table) => quote(table)).join(", ");
  await DBCall.unsafe(`truncate ${list} restart identity cascade`);
}

export async function applySeeder(seeder: Seeder) {
  const inserted = await DBCall`
    insert into ${DBCall(seeder.table)} ${DBCall(seeder.objects)}
    returning _id
  `;
  return Array.isArray(inserted) ? inserted.length : 0;
}

function quote(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}
