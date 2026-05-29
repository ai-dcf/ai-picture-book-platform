import { NextRequest, NextResponse } from "next/server";
import { recommendProjectConfig } from "@/modules/studio/application/use-cases/recommend-project-config";
import type { ProjectInfo } from "@/types/picturebook";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await request.json();
    const projectInfo = body.projectInfo as ProjectInfo | undefined;

    if (!projectInfo) {
      console.warn("[接口/参数推荐] 非法请求：缺少 projectInfo");
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: "缺少 projectInfo 参数" } },
        { status: 400 }
      );
    }

    console.info("[接口/参数推荐] 收到请求", {
      title: projectInfo.title || "待定",
      targetAge: projectInfo.targetAge,
      artStyle: projectInfo.artStyle,
      pageCount: projectInfo.pageCount,
    });
    const result = await recommendProjectConfig(projectInfo);
    const status = result.success ? 200 : 422;
    console.info("[接口/参数推荐] 请求结束", {
      success: result.success,
      status,
      durationMs: Date.now() - startTime,
      error: result.error?.message,
    });
    return NextResponse.json(result, { status });
  } catch (err) {
    console.error("[接口/参数推荐] 请求异常", {
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { success: false, error: { code: "GENERATION_FAILED", message: err instanceof Error ? err.message : "服务异常" } },
      { status: 500 }
    );
  }
}

