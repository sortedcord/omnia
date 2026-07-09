import { z } from "zod";
import { ChatOpenRouter } from "@langchain/openrouter";
import { ILLMProvider, LLMRequest, LLMResponse } from "../llm.js";
import { llmConfig } from "../config.js";

export class OpenRouterProvider implements ILLMProvider {
  providerName = "OpenRouter";
  private model: ChatOpenRouter;

  constructor(apiKey?: string, modelName: string = "google/gemini-2.5-flash") {
    const key = apiKey || llmConfig.OPENROUTER_API_KEY;
    if (!key) {
      throw new Error("OPENROUTER_API_KEY is required to initialize OpenRouterProvider");
    }
    this.model = new ChatOpenRouter({
      apiKey: key,
      model: modelName,
    });
  }

  async generateStructuredResponse<T extends z.ZodTypeAny>(
    request: LLMRequest<T>,
  ): Promise<LLMResponse<z.infer<T>>> {
    const structuredModel = this.model.withStructuredOutput(request.schema);
    const result = await structuredModel.invoke([
      { role: "system", content: request.systemPrompt },
      { role: "user", content: request.userContext },
    ]);
    return { success: true, data: result as z.infer<T> };
  }
}
