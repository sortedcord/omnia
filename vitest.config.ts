import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "tests/evals/**"
    ]
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
