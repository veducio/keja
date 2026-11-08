import { defineCommand } from "citty";
import { runProject } from "./../run-project.ts";

export const dev = defineCommand({
  meta: {
    name: "dev",
    description: "Start the development server",
  },
  async run() {
    await runProject({ wait: true });
  },
});
