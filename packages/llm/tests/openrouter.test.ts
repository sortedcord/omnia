import { describe, test, expect, vi } from "vitest";
import { z } from "zod";
import { OpenRouterProvider } from "../src/providers/openrouter.js";
import { llmConfig } from "../src/config.js";

// Mock the ChatOpenRouter class
vi.mock("@langchain/openrouter", () => {
  return {
    ChatOpenRouter: class {
      config: unknown;
      constructor(config: unknown) {
        this.config = config;
      }
      withStructuredOutput = vi.fn().mockImplementation(() => {
        return {
          invoke: vi.fn().mockImplementation(async () => {
            // Return a mock output that matches a sample schema
            return {
              name: "mocked response",
              success: true,
            };
          }),
        };
      });
    },
  };
});

describe("OpenRouterProvider Unit Tests (Tier 1)", () => {
  test("initializes successfully with a provided apiKey", () => {
    const provider = new OpenRouterProvider("dummy-key");
    expect(provider.providerName).toBe("OpenRouter");
  });

  test("initializes successfully with apiKey from config", () => {
    // Save current config
    const originalKey = llmConfig.OPENROUTER_API_KEY;
    llmConfig.OPENROUTER_API_KEY = "env-dummy-key";
    
    try {
      const provider = new OpenRouterProvider();
      expect(provider.providerName).toBe("OpenRouter");
    } finally {
      llmConfig.OPENROUTER_API_KEY = originalKey;
    }
  });

  test("throws error if no API key is provided or in config", () => {
    // Save current config
    const originalKey = llmConfig.OPENROUTER_API_KEY;
    llmConfig.OPENROUTER_API_KEY = undefined;

    try {
      expect(() => new OpenRouterProvider()).toThrow(
        "OPENROUTER_API_KEY is required to initialize OpenRouterProvider"
      );
    } finally {
      llmConfig.OPENROUTER_API_KEY = originalKey;
    }
  });

  test("generateStructuredResponse invokes the model with structured output", async () => {
    const provider = new OpenRouterProvider("dummy-key");
    const TestSchema = z.object({
      name: z.string(),
      success: z.boolean(),
    });

    const response = await provider.generateStructuredResponse({
      systemPrompt: "system prompt",
      userContext: "user context",
      schema: TestSchema,
    });

    expect(response.success).toBe(true);
    expect(response.data).toEqual({
      name: "mocked response",
      success: true,
    });
  });
});
