#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { printStartup } from "./banner.ts";
import { build } from "./commands/build.ts";
import { dev } from "./commands/dev.ts";
import { init } from "./commands/init.ts";
import { start } from "./commands/start.ts";

const main = defineCommand({
  meta: {
    name: "keja",
    description: "Run Keja",
  },
  subCommands: {
    dev,
    start,
    build,
    init,
  },
});

printStartup();
runMain(main);
