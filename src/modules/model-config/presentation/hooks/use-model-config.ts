"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import type { ModelConfigResponse, ModelDomain, ModelFormValue, ModelsConfig } from "@/modules/model-config/presentation/types";
import {
  createEmptyModelsConfig,
  deleteModelFromConfig,
  normalizeModelsConfig,
  saveModelInConfig,
  serializeModelsConfig,
  toggleModelInConfig,
} from "@/modules/model-config/presentation/utils";

const MODEL_CONFIG_QUERY_KEY = ["model-config"] as const;

async function fetchModelConfig(): Promise<ModelConfigResponse> {
  const response = await fetch("/api/model-config", {
    method: "GET",
    cache: "no-store",
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "加载模型配置失败");
  }

  return payload as ModelConfigResponse;
}

async function updateModelConfig(yamlContent: string): Promise<void> {
  const response = await fetch("/api/model-config", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ yamlContent }),
  });

  const payload = await response.json();

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "保存模型配置失败");
  }
}

export function useModelConfig() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: MODEL_CONFIG_QUERY_KEY,
    queryFn: fetchModelConfig,
  });

  const mutation = useMutation({
    mutationFn: updateModelConfig,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: MODEL_CONFIG_QUERY_KEY });
    },
  });

  const config = useMemo(() => {
    const candidate = query.data?.rawConfig ?? query.data;
    return normalizeModelsConfig(candidate ?? createEmptyModelsConfig());
  }, [query.data]);

  async function persistConfig(nextConfig: ModelsConfig, successMessage: string) {
    const yamlContent = serializeModelsConfig(nextConfig);

    try {
      await mutation.mutateAsync(yamlContent);
      toast({
        title: "操作成功",
        description: successMessage,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存模型配置失败";
      toast({
        title: "操作失败",
        description: message,
        variant: "destructive",
      });
      throw error;
    }
  }

  async function saveModel(domain: ModelDomain, originalAlias: string | null, value: ModelFormValue) {
    const nextConfig = saveModelInConfig(config, domain, originalAlias, value);
    await persistConfig(nextConfig, originalAlias ? "模型已保存" : "模型已创建");
  }

  async function deleteModel(domain: ModelDomain, alias: string) {
    const nextConfig = deleteModelFromConfig(config, domain, alias);
    await persistConfig(nextConfig, "模型已删除");
  }

  async function toggleModel(domain: ModelDomain, alias: string, enabled: boolean) {
    const nextConfig = toggleModelInConfig(config, domain, alias, enabled);
    await persistConfig(nextConfig, "模型状态已更新");
  }

  return {
    config,
    error: query.error,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    refetch: query.refetch,
    query,
    mutation,
    saveModel,
    deleteModel,
    toggleModel,
  };
}
