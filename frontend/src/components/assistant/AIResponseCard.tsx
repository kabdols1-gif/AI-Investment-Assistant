import { Bot, CheckCircle2, HelpCircle, ShieldCheck } from "lucide-react";
import { ConfirmationCard } from "@/components/safety/ConfirmationCard";
import type { ScreenKey } from "@/lib/mockData";
import type { LLMIntent } from "@/types/voice";

export interface AssistantResult {
  screen: ScreenKey;
  text: string;
  intent: LLMIntent;
}

const intentLabels: Record<string, string> = {
  get_market_briefing: "시장 브리핑 조회",
  get_asset_summary: "자산 요약 조회",
  get_strategy_status: "전략 상태 조회",
  recommend_strategy: "전략 추천",
  create_strategy: "전략 초안 생성",
  create_strategy_candidate: "전략 후보 생성",
  create_order_draft: "주문 후보 생성",
  query_account_summary: "계좌 요약 조회",
  explain_strategy: "전략 설명",
  get_watchlist_summary: "관심종목 요약",
  add_watchlist_item: "관심종목 추가",
  set_price_alert: "가격 알림 설정",
  get_portfolio_summary: "포트폴리오 요약",
  recommend_rebalancing: "리밸런싱 제안",
  get_notifications: "알림 조회",
  update_notification_setting: "알림 설정 변경",
  open_settings: "설정 열기",
  update_voice_setting: "음성 설정 변경",
  connect_llm_key: "AI Key 연결",
  connect_kb_openapi: "증권사 연결",
  unknown: "추가 확인 필요",
};

const orderLikeIntents = new Set([
  "create_order_draft",
  "recommend_rebalancing",
  "set_price_alert",
  "update_notification_setting",
  "update_voice_setting",
  "connect_llm_key",
  "connect_kb_openapi",
]);

interface AIResponseCardProps {
  result: AssistantResult | null;
}

export function AIResponseCard({ result }: AIResponseCardProps) {
  if (!result) return null;

  const { intent, text } = result;
  const label = intentLabels[intent.intent] || intent.intent;
  const needsConfirmation = orderLikeIntents.has(intent.intent) || intent.intent === "create_strategy";

  return (
    <section className="rounded-lg border border-[#dbe4f0] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-[#071832] text-[#f6b100]">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#071832]">AI 해석 결과</p>
            <p className="mt-1 text-sm text-slate-600">{intent.assistant_message || intent.raw_summary}</p>
            <p className="mt-2 rounded-lg bg-[#f8fafc] px-3 py-2 text-xs text-slate-500">
              &ldquo;{text}&rdquo;
            </p>
          </div>
        </div>
        <div className="flex flex-none items-center gap-2 rounded-full bg-[#fff8e1] px-3 py-2 text-xs font-bold text-[#8a6400]">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {label} · {Math.round(intent.confidence * 100)}%
        </div>
      </div>

      {intent.need_user_clarification && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <HelpCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          {intent.clarification_question || "추가 정보가 필요합니다."}
        </div>
      )}

      {needsConfirmation && !intent.need_user_clarification && (
        <div className="mt-4">
          <ConfirmationCard
            title="실행 전 확인 단계"
            items={[
              { label: "의도", value: label },
              { label: "대상", value: intent.symbol_name || intent.symbol_code || "화면 데이터" },
              { label: "모드", value: translateMode(intent.mode) },
              { label: "위험 확인", value: "고객 확인 후 진행" },
            ]}
            requiresAuth={orderLikeIntents.has(intent.intent)}
          />
        </div>
      )}

      {!needsConfirmation && !intent.need_user_clarification && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#eef6ff] px-3 py-2 text-sm font-semibold text-[#0f4c81]">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          조회성 요청으로 분류했습니다. 민감정보는 AI 요청에 포함하지 않습니다.
        </div>
      )}
    </section>
  );
}

function translateMode(mode: string) {
  if (mode === "live") return "실전";
  if (mode === "paper") return "모의";
  return "시뮬레이션";
}

export default AIResponseCard;
