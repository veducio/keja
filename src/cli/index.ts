#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { printStartup } from "./banner.ts";
import { build } from "./commands/build.ts";
import { dev } from "./commands/dev.ts";
import { generate } from "./commands/generate.ts";
import { init } from "./commands/init.ts";
import { migrate } from "./commands/migrate.ts";
import { seed } from "./commands/seed.ts";
import { start } from "./commands/start.ts";

const main = defineCommand({
  meta: {
    name: "keja",
    description: "Run Keja",
  },
  subCommands: {
    dev,
    start,
    migrate,
    generate,
    seed,
    build,
    init,
  },
});

printStartup();
runMain(main);
