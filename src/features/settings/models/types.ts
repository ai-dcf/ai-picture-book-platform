"use client";

export type ModelDomain = "text" | "image";

export interface ModelCredentialConfig {
  apiKey: string;
  endpoint?: string;
  [key: string]: unknown;
}

export interface ModelItemConfig {
  alias: string;
  strategy: string;
  enabled: boolean;
  credentials: ModelCredentialConfig;
  params?: Record<string, unknown>;
}

export interface ModelDomainConfig {
  enabledOrder: string[];
  items: ModelItemConfig[];
}

export interface ModelsConfig {
  textModels: ModelDomainConfig;
  imageModels: ModelDomainConfig;
}

export interface ModelConfigResponse {
  textModels: ModelDomainConfig;
  imageModels: ModelDomainConfig;
  rawConfig?: ModelsConfig;
  yamlContent?: string;
  enabledTextModels?: string[];
  enabledImageModels?: string[];
}

export interface ModelFormValue {
  alias: string;
  strategy: string;
  apiKey: string;
  endpoint: string;
  enabled: boolean;
  vendor?: string;
  modelName?: string;
}

export interface StrategyOption {
  value: string;
  label: string;
}

export type HealthBadgeStatus = "untested" | "ok" | "degraded" | "down";

export interface ModelHealthState {
  status: HealthBadgeStatus;
  latencyMs?: number;
  reason?: string;
}
