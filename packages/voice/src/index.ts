export * from "./dehydration.js";
export * from "./hydration.js";
export * from "./contractions.js";

export interface PromptComponent {
  label: string;
  type: "system" | "world" | "events" | "memories" | "input" | "other";
  content: string;
}

export interface PromptBreakdown {
  systemPrompt: string;
  userContext: string;
  components?: PromptComponent[];
}
