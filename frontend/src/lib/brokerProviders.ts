import type { BrokerProvider } from "@/types/config";

export interface BrokerProviderOption {
  id: BrokerProvider;
  name: string;
  mark: string;
  logoUrl?: string;
  description: string;
  defaultBaseUrl: string;
  baseUrlPlaceholder: string;
  connectionTestSupported: boolean;
  accountOpeningUrl?: string;
}

export const BROKER_PROVIDER_OPTIONS: BrokerProviderOption[] = [
  {
    id: "kb",
    name: "KB증권",
    mark: "KB",
    logoUrl: "https://www.google.com/s2/favicons?domain=kbsec.com&sz=64",
    description: "KB증권 BaaS/OpenAPI",
    defaultBaseUrl: "https://dbaasapi.kbsec.com:32484",
    baseUrlPlaceholder: "https://dbaasapi.kbsec.com:32484",
    connectionTestSupported: true,
    accountOpeningUrl: "https://www.kbsec.com",
  },
  {
    id: "korea_investment",
    name: "한국투자증권",
    mark: "한투",
    logoUrl: "https://www.google.com/s2/favicons?domain=securities.koreainvestment.com&sz=64",
    description: "한국투자증권 OpenAPI",
    defaultBaseUrl: "https://openapi.koreainvestment.com:9443",
    baseUrlPlaceholder: "https://openapi.koreainvestment.com:9443",
    connectionTestSupported: false,
    accountOpeningUrl: "https://securities.koreainvestment.com",
  },
  {
    id: "mirae_asset",
    name: "미래에셋증권",
    mark: "미래",
    logoUrl: "https://www.google.com/s2/favicons?domain=securities.miraeasset.com&sz=64",
    accountOpeningUrl: "https://securities.miraeasset.com",
    description: "미래에셋증권 OpenAPI",
    defaultBaseUrl: "",
    baseUrlPlaceholder: "증권사 OpenAPI Base URL",
    connectionTestSupported: false,
  },
  {
    id: "nh",
    name: "NH투자증권",
    mark: "NH",
    logoUrl: "https://www.nhqv.com/favicon.ico",
    accountOpeningUrl: "https://www.nhqv.com",
    description: "NH투자증권 OpenAPI",
    defaultBaseUrl: "",
    baseUrlPlaceholder: "증권사 OpenAPI Base URL",
    connectionTestSupported: false,
  },
  {
    id: "samsung",
    name: "삼성증권",
    mark: "삼성",
    logoUrl: "https://www.google.com/s2/favicons?domain=samsungpop.com&sz=64",
    accountOpeningUrl: "https://www.samsungpop.com",
    description: "삼성증권 OpenAPI",
    defaultBaseUrl: "",
    baseUrlPlaceholder: "증권사 OpenAPI Base URL",
    connectionTestSupported: false,
  },
  {
    id: "kiwoom",
    name: "키움증권",
    mark: "키움",
    logoUrl: "https://www.kiwoom.com/favicon.ico",
    accountOpeningUrl: "https://www.kiwoom.com",
    description: "키움증권 OpenAPI",
    defaultBaseUrl: "",
    baseUrlPlaceholder: "증권사 OpenAPI Base URL",
    connectionTestSupported: false,
  },
  {
    id: "shinhan",
    name: "신한투자증권",
    mark: "신한",
    logoUrl: "https://www.google.com/s2/favicons?domain=shinhansec.com&sz=64",
    accountOpeningUrl: "https://www.shinhansec.com",
    description: "신한투자증권 OpenAPI",
    defaultBaseUrl: "",
    baseUrlPlaceholder: "증권사 OpenAPI Base URL",
    connectionTestSupported: false,
  },
  {
    id: "daishin",
    name: "대신증권",
    mark: "대신",
    logoUrl: "https://www.google.com/s2/favicons?domain=daishin.com&sz=64",
    accountOpeningUrl: "https://www.daishin.com",
    description: "대신증권 OpenAPI",
    defaultBaseUrl: "",
    baseUrlPlaceholder: "증권사 OpenAPI Base URL",
    connectionTestSupported: false,
  },
  {
    id: "hana",
    name: "하나증권",
    mark: "하나",
    logoUrl: "https://www.google.com/s2/favicons?domain=hanaw.com&sz=64",
    accountOpeningUrl: "https://www.hanaw.com",
    description: "하나증권 OpenAPI",
    defaultBaseUrl: "",
    baseUrlPlaceholder: "증권사 OpenAPI Base URL",
    connectionTestSupported: false,
  },
  {
    id: "custom",
    name: "직접 입력",
    mark: "API",
    description: "다른 국내 증권사 OpenAPI",
    defaultBaseUrl: "",
    baseUrlPlaceholder: "증권사 OpenAPI Base URL 직접 입력",
    connectionTestSupported: false,
  },
];

export function getBrokerProviderOption(provider: BrokerProvider | string | null | undefined) {
  return BROKER_PROVIDER_OPTIONS.find((option) => option.id === provider) || BROKER_PROVIDER_OPTIONS[0];
}
