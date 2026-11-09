import { defineCommand } from "citty";
import { runDev } from "../dev-reload.ts";

export const dev = defineCommand({
  meta: {
    name: "dev",
    description: "Start the development server",
  },
  async run() {
    await runDev();
  },
});
