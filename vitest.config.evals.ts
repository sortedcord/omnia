import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/evals/**/*.eval.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"]
  }
});
