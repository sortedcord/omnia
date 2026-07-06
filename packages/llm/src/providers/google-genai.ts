import { z } from "zod";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ILLMProvider, LLMRequest, LLMResponse } from "../llm.js";
import { llmConfig } from "../config.js";

export class GeminiProvider implements ILLMProvider {
  providerName = "Gemini";
  private model: ChatGoogleGenerativeAI;

  constructor(apiKey?: string) {
    const key = apiKey || llmConfig.GOOGLE_API_KEY;
    if (!key) {
      throw new Error("GOOGLE_API_KEY is required to initialize GeminiProvider");
    }
    this.model = new ChatGoogleGenerativeAI({
      apiKey: key,
      model: "gemini-2.5-flash",
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
