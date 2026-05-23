"use client";

import { useCallback, useState } from "react";
import type {
  ProjectInfo,
  ProjectConfigRecommendation,
  StoryData,
  StoryboardData,
  AssetItem,
  AssetsData,
  PageItem,
  StoryboardPageData,
} from "@/types/picturebook";

export type GenerateError = {
  code: string;
  message: string;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: GenerateError;
};

async function callApi<T>(url: string, body: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return data as ApiResponse<T>;
}

const ERROR_MESSAGE_MAP: Record<string, string> = {
  NO_MODEL_CONFIGURED: "未配置任何模型，请先在设置中添加模型",
  MODEL_UNAVAILABLE: "模型不可用，请检查模型配置",
  GENERATION_FAILED: "生成失败，请稍后重试",
  INVALID_REQUEST: "请求参数异常",
};

function getErrorMessage(error: GenerateError): string {
  return ERROR_MESSAGE_MAP[error.code] || error.message || "未知错误";
}

export function useStudioGenerate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<GenerateError | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const recommendProjectConfig = useCallback(
    async (projectInfo: ProjectInfo): Promise<ProjectConfigRecommendation | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await callApi<ProjectConfigRecommendation>("/api/studio/recommend-project-config", { projectInfo });
        if (!result.success || !result.data) {
          setError(result.error || { code: "GENERATION_FAILED", message: "参数推荐失败" });
          return null;
        }
        return result.data;
      } catch (err) {
        setError({ code: "GENERATION_FAILED", message: err instanceof Error ? err.message : "网络异常" });
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const generateStory = useCallback(
    async (projectInfo: ProjectInfo): Promise<StoryData | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await callApi<StoryData>("/api/studio/generate-story", { projectInfo });
        if (!result.success || !result.data) {
          setError(result.error || { code: "GENERATION_FAILED", message: "故事生成失败" });
          return null;
        }
        return result.data;
      } catch (err) {
        setError({ code: "GENERATION_FAILED", message: err instanceof Error ? err.message : "网络异常" });
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const generateStoryboard = useCallback(
    async (story: StoryData, projectInfo: ProjectInfo): Promise<StoryboardData | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await callApi<StoryboardData>("/api/studio/generate-storyboard", { story, projectInfo });
        if (!result.success || !result.data) {
          setError(result.error || { code: "GENERATION_FAILED", message: "分镜生成失败" });
          return null;
        }
        return result.data;
      } catch (err) {
        setError({ code: "GENERATION_FAILED", message: err instanceof Error ? err.message : "网络异常" });
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const generateAssetImage = useCallback(
    async (asset: AssetItem, projectInfo: ProjectInfo): Promise<string | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await callApi<string>("/api/studio/generate-asset-image", { asset, projectInfo });
        if (!result.success || !result.data) {
          setError(result.error || { code: "GENERATION_FAILED", message: "资产图片生成失败" });
          return null;
        }
        return result.data;
      } catch (err) {
        setError({ code: "GENERATION_FAILED", message: err instanceof Error ? err.message : "网络异常" });
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const generatePageImage = useCallback(
    async (
      page: PageItem,
      assets: AssetsData,
      projectInfo: ProjectInfo,
      storyboardPage?: StoryboardPageData
    ): Promise<string | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await callApi<string>("/api/studio/generate-page-image", {
          page,
          assets,
          projectInfo,
          storyboardPage,
        });
        if (!result.success || !result.data) {
          setError(result.error || { code: "GENERATION_FAILED", message: "页面图片生成失败" });
          return null;
        }
        return result.data;
      } catch (err) {
        setError({ code: "GENERATION_FAILED", message: err instanceof Error ? err.message : "网络异常" });
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    recommendProjectConfig,
    generateStory,
    generateStoryboard,
    generateAssetImage,
    generatePageImage,
    loading,
    error,
    clearError,
    getErrorMessage,
  };
}
