import { defineCommand } from "citty";
import { runProject } from "./../run-project.ts";

export const start = defineCommand({
  meta: {
    name: "start",
    description: "Start the server",
  },
  async run() {
    await runProject();
  },
});
