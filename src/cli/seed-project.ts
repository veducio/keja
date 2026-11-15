import path from "node:path";
import { createInterface } from "node:readline/promises";
import { DBCall, setDatabase } from "../db/client.ts";
import { connectDatabase } from "../db/postgres.ts";
import { DependencyNotMet } from "../errors/framework-errors.ts";
import { loadConfig } from "../project/config.ts";
import { applySeeders } from "../seed/apply.ts";
import { confirmSeed } from "../seed/confirm.ts";
import { loadSeeders } from "../seed/load.ts";
import { formatSeed } from "../seed/report.ts";
import { formatProjectFailure, readProjectFailure } from "./run-project.ts";

export async function runSeed(
  root = process.cwd(),
  options: { yes?: boolean } = {},
) {
  let opened = false;
  try {
    const project = await loadConfig(root);
    if (!project.database.enabled) {
      throw new DependencyNotMet("seed", "db");
    }
    await connectDatabase(Bun.env.DATABASE_URL ?? "");
    opened = true;
    const seeders = await loadSeeders(path.join(root, "seed"));
    const tables = seeders.map((seeder) => seeder.table);
    const confirmed = await confirmSeed({
      yes: options.yes === true,
      interactive:
        process.stdin.isTTY === true && process.stdout.isTTY === true,
      tables,
      ask: askSeedConfirm,
    });
    if (confirmed === "needs-yes") {
      console.error("Pass --yes to seed without a prompt.");
      process.exitCode = 1;
      return;
    }
    if (confirmed === "no") {
      console.log("  Seed cancelled.");
      return;
    }
    const results = await applySeeders(seeders);
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

async function askSeedConfirm(message: string) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return await rl.question(`  ${message} [y/N] `);
  } finally {
    rl.close();
  }
}
