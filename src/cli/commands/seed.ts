import { defineCommand } from "citty";
import { runSeed } from "../seed-project.ts";

export const seed = defineCommand({
  meta: {
    name: "seed",
    description: "Clear seeded tables and insert project seeders",
  },
  args: {
    yes: {
      type: "boolean",
      description: "Skip the confirmation prompt",
      alias: "y",
      default: false,
    },
  },
  async run({ args }) {
    await runSeed(process.cwd(), { yes: args.yes === true });
  },
});
