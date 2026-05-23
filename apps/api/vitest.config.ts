import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["dotenv/config"],
    pool: "forks",
    fileParallelism: false,
  },
});
