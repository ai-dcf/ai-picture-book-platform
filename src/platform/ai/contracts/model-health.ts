import "server-only";

export interface HealthResult {
  success: boolean;
  latencyMs?: number;
  data?: {
    status: "ok" | "degraded" | "down";
    latencyMs?: number;
    reason?: string;
  };
  error?: { message: string };
}

export interface ModelConfigItem {
  alias: string;
  strategy: string;
  enabled: boolean;
  credentials: { apiKey: string; endpoint?: string; [key: string]: unknown };
  params?: Record<string, unknown>;
}
