import { apiPost } from "./client";
import type {
  ConfirmOrderRequest,
  ExecutionResult,
  LLMIntent,
  OrderProposal,
  StrategyAnalysis,
  StrategyCard,
  VoiceCommand,
} from "@/types/voice";

export function interpretVoice(command: VoiceCommand): Promise<LLMIntent> {
  return apiPost<LLMIntent>("/api/voice/interpret", {
    locale: "ko-KR",
    ...command,
  });
}

export function createStrategyCard(intent: LLMIntent): Promise<StrategyCard> {
  return apiPost<StrategyCard>("/api/voice/strategy-card", intent);
}

export function createStrategyAnalysis(intent: LLMIntent, sourceText: string): Promise<StrategyAnalysis> {
  return apiPost<StrategyAnalysis>("/api/voice/strategy-analysis", {
    intent,
    source_text: sourceText,
  });
}

export function createOrderProposal(intent: LLMIntent): Promise<OrderProposal> {
  return apiPost<OrderProposal>("/api/voice/order-proposal", intent);
}

export function confirmVoiceOrder(request: ConfirmOrderRequest): Promise<ExecutionResult> {
  return apiPost<ExecutionResult>("/api/voice/confirm-order", request);
}
