"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import type { ModelDomain, ModelHealthState } from "@/features/settings/models/types";

interface RawHealthResult {
  success?: boolean;
  latencyMs?: number;
  data?: {
    status?: "ok" | "degraded" | "down";
    latencyMs?: number;
    reason?: string;
  };
  error?: {
    message?: string;
  };
}

function createKey(domain: ModelDomain, alias: string): string {
  return `${domain}:${alias}`;
}

function normalizeHealthResult(result: RawHealthResult): ModelHealthState {
  if (result.success && result.data?.status) {
    return {
      status: result.data.status,
      latencyMs: result.data.latencyMs ?? result.latencyMs,
      reason: result.data.reason,
    };
  }

  return {
    status: "down",
    latencyMs: result.data?.latencyMs ?? result.latencyMs,
    reason: result.error?.message ?? result.data?.reason ?? "连接失败",
  };
}

export function useModelHealth() {
  const [healthStateMap, setHealthStateMap] = useState<Record<string, ModelHealthState>>({});
  const [testingKey, setTestingKey] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ domain, alias }: { domain: ModelDomain; alias: string }) => {
      const response = await fetch("/api/health/model", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ domain, alias }),
      });

      const payload = (await response.json()) as RawHealthResult;

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "测试连接失败");
      }

      return payload;
    },
  });

  async function testHealth(domain: ModelDomain, alias: string) {
    const key = createKey(domain, alias);
    setTestingKey(key);

    try {
      const result = await mutation.mutateAsync({ domain, alias });
      const nextState = normalizeHealthResult(result);

      setHealthStateMap((current) => ({
        ...current,
        [key]: nextState,
      }));

      toast({
        title: "测试完成",
        description:
          nextState.status === "ok"
            ? `${alias} 连接正常`
            : `${alias} ${nextState.reason ?? "连接状态异常"}`,
        variant: nextState.status === "ok" ? "default" : "destructive",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "测试连接失败";

      setHealthStateMap((current) => ({
        ...current,
        [key]: {
          status: "down",
          reason: message,
        },
      }));

      toast({
        title: "测试失败",
        description: `${alias} ${message}`,
        variant: "destructive",
      });
    } finally {
      setTestingKey(null);
    }
  }

  const getHealthState = useMemo(
    () => (domain: ModelDomain, alias: string): ModelHealthState => {
      return healthStateMap[createKey(domain, alias)] ?? { status: "untested" };
    },
    [healthStateMap]
  );

  return {
    testHealth,
    testingKey,
    getHealthState,
  };
}
