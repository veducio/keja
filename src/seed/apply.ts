import type { SQL } from "bun";
import { DBCall } from "../db/client.ts";
import type { Seeder } from "./define.ts";

export async function truncateSeedTables(
  tables: readonly string[],
  sql: SQL = DBCall,
) {
  const unique = [...new Set(tables)];
  if (unique.length === 0) {
    return;
  }
  const list = unique.map((table) => quote(table)).join(", ");
  await sql.unsafe(`truncate ${list} restart identity cascade`);
}

export async function applySeeder(seeder: Seeder, sql: SQL = DBCall) {
  const inserted = await sql`
    insert into ${sql(seeder.table)} ${sql(seeder.objects)}
    returning _id
  `;
  return Array.isArray(inserted) ? inserted.length : 0;
}

export async function applySeeders(seeders: readonly Seeder[]) {
  const tables = seeders.map((seeder) => seeder.table);
  return DBCall.begin(async (tx) => {
    await truncateSeedTables(tables, tx);
    const results: { table: string; inserted: number }[] = [];
    for (const seeder of seeders) {
      results.push({
        table: seeder.table,
        inserted: await applySeeder(seeder, tx),
      });
    }
    return results;
  });
}

function quote(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}
