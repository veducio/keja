import { defineConfig } from "@veducio/keja";

export default defineConfig({
  public_path: "src/public",
  service_path: "src/service",
  db: { enabled: true },
});
