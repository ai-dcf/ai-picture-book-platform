import { NextRequest, NextResponse } from "next/server";
import { getTextModelFactory, getImageModelFactory } from "@/platform/ai/registry/model-factory";
import { ensureModelsInitialized } from "@/platform/ai/registry/model-init";

export const runtime = "nodejs";

type HealthError = {
  code: string;
  message: string;
};

function mapProviderErrorMessage(message?: string): HealthError | null {
  if (!message) return null;
  const matched = message.match(/HTTP\s+(\d{3})/i);
  if (!matched) return null;

  const status = Number(matched[1]);
  if (status === 401) {
    return { code: "API_KEY_INVALID", message: "API Key 无效，请检查密钥配置" };
  }
  if (status === 403) {
    return { code: "PERMISSION_DENIED", message: "账号权限不足，无法访问目标模型" };
  }
  if (status === 404) {
    return { code: "MODEL_OR_ENDPOINT_INVALID", message: "模型不存在或 Endpoint 配置错误" };
  }
  if (status === 429) {
    return { code: "RATE_LIMITED", message: "请求过于频繁，请稍后重试" };
  }
  if (status >= 500) {
    return { code: "PROVIDER_INTERNAL_ERROR", message: "服务商内部错误，请稍后重试" };
  }
  return { code: "PROVIDER_REQUEST_FAILED", message };
}

export async function POST(request: NextRequest) {
  try {
    ensureModelsInitialized();

    const body = await request.json();
    const { alias, domain } = body;

    if (!alias) {
      return NextResponse.json(
        { success: false, error: { code: "PARAM_INVALID", message: "alias is required" } },
        { status: 400 }
      );
    }
    if (domain && domain !== "text" && domain !== "image") {
      return NextResponse.json(
        { success: false, error: { code: "PARAM_INVALID", message: "domain must be 'text' or 'image'" } },
        { status: 400 }
      );
    }

    let result;

    if (domain === "image") {
      const factory = getImageModelFactory();
      const strategy = factory.get(alias);
      result = await strategy.health();
    } else {
      const factory = getTextModelFactory();
      const strategy = factory.get(alias);
      result = await strategy.health();
    }

    if (!result.success) {
      const mappedError = mapProviderErrorMessage(result.error?.message) ?? {
        code: "NETWORK_OR_TIMEOUT",
        message: result.error?.message ?? "连接失败，请检查网络或超时设置",
      };
      return NextResponse.json(
        {
          ...result,
          error: mappedError,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    const message = err?.message ?? "Unknown error";
    if (/strategy .* not found/i.test(message)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MODEL_ALIAS_NOT_FOUND",
            message: "模型别名不存在或当前模型未启用",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
