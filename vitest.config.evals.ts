import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables for evals at test process startup
dotenv.config();

export default defineConfig({
  test: {
    include: ["tests/evals/**/*.eval.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"]
  },
  resolve: {
    alias: {
      "@omnia/core": path.resolve(__dirname, "./packages/core/src"),
      "@omnia/llm": path.resolve(__dirname, "./packages/llm/src"),
      "@omnia/architect": path.resolve(__dirname, "./packages/architect/src"),
      "@omnia/intent": path.resolve(__dirname, "./packages/intent/src"),
      "@omnia/memory": path.resolve(__dirname, "./packages/memory/src"),
      "@omnia/spatial": path.resolve(__dirname, "./packages/spatial/src"),
      "@omnia/cli": path.resolve(__dirname, "./cli/src")
    }
  }
});
