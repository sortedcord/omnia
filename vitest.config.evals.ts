import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

// Load environment variables for evals at test process startup
dotenv.config();

export default defineConfig({
  test: {
    include: ["tests/evals/**/*.eval.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"]
  }
});
