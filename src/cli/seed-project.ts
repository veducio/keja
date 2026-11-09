import path from "node:path";
import { DBCall, setDatabase } from "../db/client.ts";
import { connectDatabase } from "../db/postgres.ts";
import { DependencyNotMet } from "../errors/framework-errors.ts";
import { loadConfig } from "../project/config.ts";
import { applySeeder } from "../seed/apply.ts";
import { loadSeeders } from "../seed/load.ts";
import { formatSeed } from "../seed/report.ts";
import { formatProjectFailure, readProjectFailure } from "./run-project.ts";

export async function runSeed(root = process.cwd()) {
  let opened = false;
  try {
    const project = await loadConfig(root);
    if (!project.database.enabled) {
      throw new DependencyNotMet("seed", "db");
    }
    await connectDatabase(Bun.env.DATABASE_URL ?? "");
    opened = true;
    const seeders = await loadSeeders(path.join(root, "seed"));
    const results = [];
    for (const seeder of seeders) {
      results.push({
        table: seeder.table,
        inserted: await applySeeder(seeder),
      });
    }
    console.log(formatSeed(results, process.stdout.isTTY === true));
  } catch (error) {
    console.error(
      formatProjectFailure(readProjectFailure(error), {
        wait: false,
        color: process.stderr.isTTY === true,
      }),
    );
    process.exitCode = 1;
  } finally {
    if (opened) {
      await DBCall.close();
      setDatabase(null);
    }
  }
  if (process.exitCode === 1) {
    process.exit(1);
  }
}
