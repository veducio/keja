import { defineCommand } from "citty";
import {
  askOnTerminal,
  runCommand,
  runInit,
  starterPaths,
} from "../init-project.ts";

export const init = defineCommand({
  meta: {
    name: "init",
    description: "Create a new project",
  },
  args: {
    name: {
      type: "string",
      description: "Name of the project",
    },
    dir: {
      type: "string",
      description: "Where to create the project",
    },
    public: {
      type: "string",
      description: "Public route folder",
    },
    service: {
      type: "string",
      description: "Service route folder",
    },
  },
  async run({ args }) {
    const paths = starterPaths();
    try {
      await runInit({
        input: {
          name: args.name,
          dir: args.dir,
          public: args.public,
          service: args.service,
        },
        cwd: process.cwd(),
        templateDir: paths.templateDir,
        packageRoot: paths.packageRoot,
        interactive: process.stdin.isTTY === true,
        ask: askOnTerminal,
        run: runCommand,
        log(message) {
          console.log(message);
        },
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : "init failed");
      process.exit(1);
    }
  },
});
