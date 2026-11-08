import { defineCommand } from "citty";

export const build = defineCommand({
  meta: {
    name: "build",
    description: "Build the server",
  },
  run() {
    console.error("build is not implemented");
    process.exit(1);
  },
});
