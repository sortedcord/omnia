import { RuntimeService } from "@omnia/runtime";

export const simulationManager = new RuntimeService();

export type {
  SimSnapshot,
  EntityInfo,
  LogEntry,
  IntentInfo,
  WaitingContext,
} from "@omnia/runtime";
