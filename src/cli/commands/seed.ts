import { defineCommand } from "citty";
import { runSeed } from "../seed-project.ts";

export const seed = defineCommand({
  meta: {
    name: "seed",
    description: "Insert project seeders",
  },
  async run() {
    await runSeed();
  },
});
