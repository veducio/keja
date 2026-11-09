import { defineCommand } from "citty";
import { runMigrate } from "../migrate-project.ts";

export const migrate = defineCommand({
  meta: {
    name: "migrate",
    description: "Apply project migrations",
  },
  async run() {
    await runMigrate();
  },
});
