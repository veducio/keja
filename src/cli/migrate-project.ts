import { migrateDatabase } from "../db/postgres.ts";
import { DependencyNotMet } from "../errors/framework-errors.ts";
import { loadConfig } from "../project/config.ts";
import { printDatabase } from "./banner.ts";
import { formatProjectFailure, readProjectFailure } from "./run-project.ts";

export async function runMigrate(root = process.cwd()) {
  try {
    const project = await loadConfig(root);
    if (!project.database.enabled) {
      throw new DependencyNotMet("migrate", "db");
    }
    printDatabase(
      await migrateDatabase(
        project.database.migrations,
        Bun.env.DATABASE_URL ?? "",
      ),
    );
  } catch (error) {
    console.error(
      formatProjectFailure(readProjectFailure(error), {
        wait: false,
        color: process.stderr.isTTY === true,
      }),
    );
    process.exitCode = 1;
  }
  if (process.exitCode === 1) {
    process.exit(1);
  }
}
