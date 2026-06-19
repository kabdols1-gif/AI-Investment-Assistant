"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw, Search, Server, XCircle } from "lucide-react";
import { AppShell } from "@/components/layout";
import { getOpenApiLogs, type AuditLogRecord } from "@/lib/api/logs";

type LoadState = "idle" | "loading" | "success" | "error";

const LIMIT_OPTIONS = [50, 100, 200, 500];
const DAY_OPTIONS = [1, 3, 7, 14, 30];

export default function LogsPage() {
  const [records, setRecords] = useState<AuditLogRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(100);
  const [days, setDays] = useState(7);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLogs = useCallback(() => {
    setLoadState("loading");
    setErrorMessage(null);
    getOpenApiLogs(limit, days)
      .then((response) => {
        const nextRecords = response.data.events;
        setRecords(nextRecords);
        setSelectedId((current) =>
          current && nextRecords.some((record) => recordId(record) === current) ? current : recordId(nextRecords[0])
        );
        setLoadState("success");
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "로그를 불러오지 못했습니다.");
        setLoadState("error");
      });
  }, [days, limit]);

  useEffect(() => {
    const timer = window.setTimeout(loadLogs, 0);
    return () => window.clearTimeout(timer);
  }, [loadLogs]);

  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return records;
    return records.filter((record) => {
      const payload = getPayload(record);
      return [
        record.event,
        getText(payload.mode),
        getText(payload.service_code),
        getText(payload.method),
        getText(payload.path),
        getText(payload.url),
        getText(payload.status_code),
        getResponseMessage(payload),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [query, records]);

  const selectedRecord =
    filteredRecords.find((record) => recordId(record) === selectedId) ?? filteredRecords[0] ?? null;

  const summary = useMemo(() => {
    const success = records.filter((record) => getPayload(record).ok === true).length;
    const failed = records.filter((record) => getPayload(record).ok === false).length;
    const b2b = records.filter((record) => getPayload(record).mode === "b2b").length;
    const b2c = records.filter((record) => getPayload(record).mode === "b2c").length;
    return { total: records.length, success, failed, b2b, b2c };
  }, [records]);

  return (
    <AppShell screen="logs">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Metric icon={Server} label="전체 호출" value={`${summary.total.toLocaleString("ko-KR")}건`} />
        <Metric icon={CheckCircle2} label="성공" value={`${summary.success.toLocaleString("ko-KR")}건`} tone="success" />
        <Metric icon={XCircle} label="실패" value={`${summary.failed.toLocaleString("ko-KR")}건`} tone="danger" />
        <Metric icon={Clock} label="B2B" value={`${summary.b2b.toLocaleString("ko-KR")}건`} />
        <Metric icon={Clock} label="B2C" value={`${summary.b2c.toLocaleString("ko-KR")}건`} />
      </section>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-700 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
            <Search className="h-4 w-4 flex-none text-slate-400" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="서비스, 경로, 상태 검색"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#071832] outline-none placeholder:text-slate-400 dark:text-white"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              aria-label="조회 기간"
            >
              {DAY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}일
                </option>
              ))}
            </select>
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              aria-label="조회 건수"
            >
              {LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}건
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadLogs}
              disabled={loadState === "loading"}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#071832] px-4 text-sm font-extrabold text-white transition hover:bg-[#102642] disabled:opacity-60 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
            >
              {loadState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
              새로고침
            </button>
          </div>
        </div>

        {loadState === "error" && (
          <div className="m-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            {errorMessage}
          </div>
        )}

        <div className="grid min-h-[560px] lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full border-collapse text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs font-black uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">시간</th>
                  <th className="px-4 py-3">구분</th>
                  <th className="px-4 py-3">대상</th>
                  <th className="px-4 py-3">메서드</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">메시지</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => {
                  const payload = getPayload(record);
                  const id = recordId(record);
                  const active = id === recordId(selectedRecord);
                  return (
                    <tr
                      key={id}
                      onClick={() => setSelectedId(id)}
                      className={`cursor-pointer border-t border-slate-100 transition hover:bg-[#fff8e1] dark:border-slate-800 dark:hover:bg-slate-800 ${
                        active ? "bg-[#fff8e1] dark:bg-slate-800" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {formatTimestamp(record.timestamp)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                          {eventLabel(record)}
                        </span>
                      </td>
                      <td className="max-w-[280px] truncate px-4 py-3 font-bold text-[#071832] dark:text-white">
                        {targetLabel(payload)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                        {getText(payload.method) || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge payload={payload} />
                      </td>
                      <td className="max-w-[260px] truncate px-4 py-3 text-slate-600 dark:text-slate-300">
                        {getResponseMessage(payload) || "-"}
                      </td>
                    </tr>
                  );
                })}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
                      조회된 OpenAPI 호출 이력이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <aside className="border-t border-slate-200 p-4 dark:border-slate-700 lg:border-l lg:border-t-0">
            {selectedRecord ? (
              <LogDetail record={selectedRecord} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm font-bold text-slate-500 dark:border-slate-700 dark:text-slate-400">
                로그를 선택하세요.
              </div>
            )}
          </aside>
        </div>
      </section>
    </AppShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof Server;
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger";
}) {
  const toneClass =
    tone === "success" ? "text-emerald-600 dark:text-emerald-300" : tone === "danger" ? "text-red-600 dark:text-red-300" : "text-[#8a6400] dark:text-amber-300";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <Icon className={`h-5 w-5 ${toneClass}`} aria-hidden="true" />
      <p className="mt-3 text-xs font-bold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black tracking-normal text-[#071832] dark:text-white">{value}</p>
    </div>
  );
}

function LogDetail({ record }: { record: AuditLogRecord }) {
  const payload = getPayload(record);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{eventLabel(record)}</p>
        <h2 className="mt-1 break-all text-lg font-black tracking-normal text-[#071832] dark:text-white">
          {targetLabel(payload)}
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <DetailField label="시간" value={formatTimestamp(record.timestamp)} />
        <DetailField label="상태" value={statusText(payload)} />
        <DetailField label="메서드" value={getText(payload.method) || "-"} />
        <DetailField label="마스킹" value={record.sensitive_masked ? "적용" : "미적용"} />
      </div>
      <pre className="max-h-[420px] overflow-auto rounded-lg bg-[#071832] p-4 text-xs leading-5 text-slate-100">
        {JSON.stringify(record, null, 2)}
      </pre>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-[#f8fafc] p-3 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[11px] font-black text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 break-all font-bold text-[#071832] dark:text-white">{value}</p>
    </div>
  );
}

function StatusBadge({ payload }: { payload: Record<string, unknown> }) {
  const ok = payload.ok;
  const className =
    ok === true
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : ok === false
        ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
        : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200";
  return <span className={`rounded-full px-2 py-1 text-xs font-black ${className}`}>{statusText(payload)}</span>;
}

function statusText(payload: Record<string, unknown>) {
  const statusCode = getText(payload.status_code);
  if (payload.ok === true) return statusCode ? `성공 ${statusCode}` : "성공";
  if (payload.ok === false) return statusCode ? `실패 ${statusCode}` : "실패";
  return statusCode || "-";
}

function eventLabel(record: AuditLogRecord) {
  if (record.event === "openapi.b2b.call") return "KB B2B";
  if (record.event === "openapi.b2b.token_refresh") return "KB B2B Token";
  if (record.event === "openapi.b2c.proxy") return "KB B2C Proxy";
  if (record.event === "openapi.b2c.token") return "KB B2C Token";
  if (record.event === "openapi.b2c.app_registration") return "KB B2C App";
  return record.event;
}

function targetLabel(payload: Record<string, unknown>) {
  return (
    getText(payload.service_code) ||
    getText(payload.path) ||
    getText(payload.url) ||
    getText(payload.provider) ||
    "-"
  );
}

function getResponseMessage(payload: Record<string, unknown>) {
  const responseBody = payload.response_body;
  if (!isRecord(responseBody)) return getText(payload.error);
  const body = isRecord(responseBody.dataBody) ? responseBody.dataBody : responseBody;
  return getText(body.oMsg) || getText(body.message) || getText(body.msg) || getText(payload.error);
}

function getPayload(record: AuditLogRecord) {
  return isRecord(record.payload) ? record.payload : {};
}

function recordId(record: AuditLogRecord | null | undefined) {
  if (!record) return null;
  return `${record.timestamp}:${record.event}:${targetLabel(getPayload(record))}`;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getText(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}
