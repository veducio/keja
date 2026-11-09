import { defineCommand } from "citty";
import { runGenerate } from "../generate-project.ts";

export const generate = defineCommand({
  meta: {
    name: "generate",
    description: "Generate repositories from migrations",
  },
  async run() {
    await runGenerate();
  },
});
